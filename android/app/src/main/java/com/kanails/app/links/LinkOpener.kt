package com.kanails.app.links

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import androidx.browser.customtabs.CustomTabColorSchemeParams
import androidx.browser.customtabs.CustomTabsClient
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.net.toUri

interface LinkOpener {
    /** Opens a KA Nails page in a Custom Tab or another browser; false if none can. */
    fun openPage(url: String): Boolean

    /** Opens a phone or messenger link in the app that handles it; false if none does. */
    fun openContact(href: String): Boolean
}

class AndroidLinkOpener(private val activity: Activity) : LinkOpener {
    override fun openPage(url: String): Boolean {
        val uri = url.toUri()
        val provider = CustomTabsClient.getPackageName(activity, null)
        if (provider != null) {
            val tab = CustomTabsIntent.Builder()
                .setShowTitle(true)
                .setDefaultColorSchemeParams(
                    CustomTabColorSchemeParams.Builder().setToolbarColor(CREAM).build(),
                )
                .build()
            tab.intent.setPackage(provider)
            if (launch { tab.launchUrl(activity, uri) }) return true
        }
        return launch {
            activity.startActivity(
                Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE),
            )
        }
    }

    override fun openContact(href: String): Boolean {
        val uri = href.toUri()
        val action = if (uri.scheme == "tel") Intent.ACTION_DIAL else Intent.ACTION_VIEW
        return launch { activity.startActivity(Intent(action, uri)) }
    }

    private inline fun launch(start: () -> Unit): Boolean = try {
        start()
        true
    } catch (_: ActivityNotFoundException) {
        false
    }

    private companion object {
        /** --ka-cream from app/globals.css. */
        const val CREAM = 0xFFFDF8F2.toInt()
    }
}
