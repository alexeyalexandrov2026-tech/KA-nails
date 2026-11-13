package com.kanails.app.links

import com.kanails.app.catalog.Catalog
import com.kanails.app.catalog.Lang

/** Pages of the live KA Nails site that the app opens in the browser. */
object SiteLinks {
    private val LOOK_ID = Regex("^work-\\d{2}$")

    /**
     * The booking page in the chosen language. A portfolio look goes through the
     * site's existing ?look=work-NN parameter; anything else is dropped.
     */
    fun booking(catalog: Catalog, lang: Lang, lookId: String? = null): String {
        val locale = catalog[lang]
        val page = catalog.siteUrl + locale.bookPath
        val known = lookId != null && LOOK_ID.matches(lookId) &&
            locale.works.any { it.id == lookId }
        return if (known) "$page?look=$lookId" else page
    }

    /** The home page in the chosen language, where the site's AI chat lives. */
    fun chat(catalog: Catalog, lang: Lang): String = catalog.siteUrl + catalog[lang].homePath
}
