package com.kanails.app.ui

import android.content.res.AssetManager
import android.graphics.BitmapFactory
import android.util.LruCache
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Decoded catalog photos, kept within a fixed memory budget. */
internal object AssetBitmaps {
    private val cache = object : LruCache<String, ImageBitmap>(32 * 1024 * 1024) {
        override fun sizeOf(key: String, value: ImageBitmap) = value.width * value.height * 4
    }

    fun cached(path: String): ImageBitmap? = cache.get(path)

    fun load(assets: AssetManager, path: String): ImageBitmap? = cached(path) ?: try {
        assets.open(path).use { BitmapFactory.decodeStream(it) }
            ?.asImageBitmap()
            ?.also { cache.put(path, it) }
    } catch (_: IOException) {
        null
    }
}

/** A WebP from the offline catalog, decoded off the main thread. */
@Composable
internal fun AssetImage(
    path: String,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
    alignment: Alignment = Alignment.Center,
) {
    val assets = LocalContext.current.assets
    val bitmap by produceState(AssetBitmaps.cached(path), path) {
        value = AssetBitmaps.cached(path)
            ?: withContext(Dispatchers.IO) { AssetBitmaps.load(assets, path) }
    }
    val image = bitmap
    if (image != null) {
        Image(
            bitmap = image,
            contentDescription = contentDescription,
            modifier = modifier,
            alignment = alignment,
            contentScale = contentScale,
        )
    } else {
        Box(
            modifier
                .background(KaColors.CreamDeep)
                .semantics { if (contentDescription != null) this.contentDescription = contentDescription },
        )
    }
}
