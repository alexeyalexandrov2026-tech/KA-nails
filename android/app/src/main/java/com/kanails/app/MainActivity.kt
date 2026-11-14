package com.kanails.app

import android.graphics.Color
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.content.edit
import com.kanails.app.catalog.CatalogParser
import com.kanails.app.catalog.Lang
import com.kanails.app.links.AndroidLinkOpener
import com.kanails.app.ui.KaApp
import com.kanails.app.ui.KaTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
        )
        super.onCreate(savedInstanceState)
        val catalog = assets.open(CatalogParser.ASSET_PATH).bufferedReader().use {
            CatalogParser.parse(it.readText())
        }
        // Only the chosen language is stored; the app keeps no client data.
        val settings = getSharedPreferences(SETTINGS, MODE_PRIVATE)
        val initialLang = Lang.fromCode(settings.getString(LANG_KEY, null))
            ?: Lang.fromSystem(resources.configuration.locales[0])
        val opener = AndroidLinkOpener(this)
        setContent {
            KaTheme {
                KaApp(
                    catalog = catalog,
                    opener = opener,
                    initialLang = initialLang,
                    onLangChange = { lang -> settings.edit { putString(LANG_KEY, lang.code) } },
                )
            }
        }
    }

    private companion object {
        const val SETTINGS = "settings"
        const val LANG_KEY = "lang"
    }
}
