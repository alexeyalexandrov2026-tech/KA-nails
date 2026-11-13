package com.kanails.app

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.kanails.app.catalog.Catalog
import com.kanails.app.catalog.CatalogParser
import com.kanails.app.catalog.Lang
import com.kanails.app.links.LinkOpener
import com.kanails.app.ui.KaApp
import com.kanails.app.ui.KaTheme
import com.kanails.app.ui.appCopy
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class KaAppTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val catalog: Catalog by lazy {
        InstrumentationRegistry.getInstrumentation().targetContext.assets
            .open(CatalogParser.ASSET_PATH).bufferedReader()
            .use { CatalogParser.parse(it.readText()) }
    }

    /** Records links instead of starting a browser, dialer or messenger. */
    private class FakeOpener(private val hasBrowser: Boolean = true) : LinkOpener {
        val pages = mutableListOf<String>()
        val contacts = mutableListOf<String>()

        override fun openPage(url: String) = hasBrowser.also { if (it) pages += url }

        override fun openContact(href: String) = true.also { contacts += href }
    }

    private fun show(lang: Lang, opener: LinkOpener = FakeOpener()) {
        rule.setContent { KaTheme { KaApp(catalog, opener, lang) } }
    }

    private fun pressBack() {
        rule.runOnUiThread { rule.activity.onBackPressedDispatcher.onBackPressed() }
        rule.waitForIdle()
    }

    @Test
    fun servicesShowTheCatalogMenuInEnglish() {
        show(Lang.EN)
        val first = catalog[Lang.EN].services.first()
        rule.onNodeWithTag("offer-${first.id}")
            .assertIsDisplayed()
            .assert(hasText(first.name))
            .assert(hasText(first.price))
    }

    @Test
    fun switchingToRussianShowsTheRussianMenu() {
        show(Lang.EN)
        rule.onNodeWithTag("lang-ru").performClick()
        val ru = catalog[Lang.RU]
        val first = ru.services.first()
        rule.onNodeWithTag("offer-${first.id}")
            .assertIsDisplayed()
            .assert(hasText(first.name))
            .assert(hasText(first.price))
        rule.onNodeWithText(ru.labels.gallery).assertIsDisplayed()
    }

    @Test
    fun bookingAndChatOpenTheLocalizedSite() {
        val opener = FakeOpener()
        show(Lang.RU, opener)
        rule.onNodeWithTag("book-button").performClick()
        rule.onNodeWithTag("chat-button").performClick()
        assertEquals(
            listOf("${catalog.siteUrl}/ru/book/", "${catalog.siteUrl}/ru/"),
            opener.pages,
        )
    }

    @Test
    fun photoViewerBooksTheLookAndBackReturnsStepByStep() {
        val opener = FakeOpener()
        show(Lang.EN, opener)
        val work = catalog[Lang.EN].works.first()
        rule.onNodeWithTag("tab-gallery").performClick()
        rule.onNodeWithTag("work-${work.id}").performClick()
        rule.onNodeWithTag("viewer").assertIsDisplayed()
        rule.onNodeWithText(work.title).assertIsDisplayed()
        rule.onNodeWithTag("viewer-book").performClick()
        assertEquals(listOf("${catalog.siteUrl}/book/?look=${work.id}"), opener.pages)

        pressBack()
        rule.onNodeWithTag("viewer").assertDoesNotExist()
        rule.onNodeWithTag("gallery").assertIsDisplayed()
        pressBack()
        rule.onNodeWithTag("services").assertIsDisplayed()
    }

    @Test
    fun missingBrowserShowsAMessage() {
        show(Lang.EN, FakeOpener(hasBrowser = false))
        rule.onNodeWithTag("book-button").performClick()
        rule.onNodeWithText(appCopy(Lang.EN).noBrowser).assertIsDisplayed()
    }

    @Test
    fun contactsOpenThePublicChannels() {
        val opener = FakeOpener()
        show(Lang.EN, opener)
        rule.onNodeWithTag("tab-contact").performClick()
        val channels = catalog[Lang.EN].channels
        channels.forEach { rule.onNodeWithTag("channel-${it.kind}").performClick() }
        assertEquals(channels.map { it.href }, opener.contacts)
    }
}
