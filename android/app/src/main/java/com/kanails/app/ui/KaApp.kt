package com.kanails.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.kanails.app.catalog.Catalog
import com.kanails.app.catalog.Category
import com.kanails.app.catalog.Channel
import com.kanails.app.catalog.Labels
import com.kanails.app.catalog.Lang
import com.kanails.app.links.LinkOpener
import com.kanails.app.links.SiteLinks
import kotlinx.coroutines.launch

enum class Section { SERVICES, GALLERY, CONTACT }

/** App-only copy; every business fact comes from the catalog instead. */
internal class AppCopy(
    val languageName: String,
    val offlineNote: String,
    val bookLook: String,
    val close: String,
    val noBrowser: String,
    val noContactApp: String,
    val photoPosition: (Int, Int) -> String,
)

internal fun appCopy(lang: Lang): AppCopy = when (lang) {
    Lang.EN -> AppCopy(
        languageName = "English",
        offlineNote = "Prices and photos are stored in the app and open without internet. " +
            "Booking and the chat open on the KA Nails website.",
        bookLook = "Book with this look",
        close = "Close",
        noBrowser = "No browser can open the KA Nails page. " +
            "Install or turn on a browser such as Chrome, then try again.",
        noContactApp = "No app on this device can open this contact.",
        photoPosition = { index, total -> "$index / $total" },
    )
    Lang.RU -> AppCopy(
        languageName = "Русский",
        offlineNote = "Цены и фото хранятся в приложении и открываются без интернета. " +
            "Запись и чат открываются на сайте KA Nails.",
        bookLook = "Записаться с этим образом",
        close = "Закрыть",
        noBrowser = "Нет браузера, чтобы открыть страницу KA Nails. " +
            "Установите или включите браузер, например Chrome, и попробуйте снова.",
        noContactApp = "На устройстве нет приложения для этого способа связи.",
        photoPosition = { index, total -> "$index из $total" },
    )
}

@Composable
fun KaApp(
    catalog: Catalog,
    opener: LinkOpener,
    initialLang: Lang,
    onLangChange: (Lang) -> Unit = {},
) {
    var lang by rememberSaveable { mutableStateOf(initialLang) }
    var section by rememberSaveable { mutableStateOf(Section.SERVICES) }
    var category by rememberSaveable { mutableStateOf(Category.ALL) }
    var viewerWorkId by rememberSaveable { mutableStateOf<String?>(null) }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    val locale = catalog[lang]
    val copy = appCopy(lang)
    val works = locale.works.filter { category == Category.ALL || it.category == category }

    fun notify(message: String) {
        scope.launch {
            snackbar.currentSnackbarData?.dismiss()
            snackbar.showSnackbar(message)
        }
    }
    fun openPage(url: String) {
        if (!opener.openPage(url)) notify(copy.noBrowser)
    }
    val openBooking = { openPage(SiteLinks.booking(catalog, lang)) }
    val openChat = { openPage(SiteLinks.chat(catalog, lang)) }
    val openContact = { channel: Channel ->
        if (!opener.openContact(channel.href)) notify(copy.noContactApp)
    }

    // System Back: the photo viewer closes itself; other sections return to Services.
    BackHandler(enabled = viewerWorkId == null && section != Section.SERVICES) {
        section = Section.SERVICES
    }

    val viewerStart = works.indexOfFirst { it.id == viewerWorkId }
    Box(Modifier.fillMaxSize()) {
        Scaffold(
            // While the photo viewer is open, screen readers must not reach the page below.
            modifier = if (viewerStart >= 0) Modifier.clearAndSetSemantics {} else Modifier,
            topBar = {
                TopBar(
                    logo = catalog.logo,
                    lang = lang,
                    onLang = {
                        lang = it
                        onLangChange(it)
                    },
                    section = section,
                    labels = locale.labels,
                    onSection = { section = it },
                )
            },
            containerColor = MaterialTheme.colorScheme.background,
        ) { padding ->
            val content = Modifier.padding(padding).fillMaxSize()
            when (section) {
                Section.SERVICES -> ServicesScreen(locale, copy, openBooking, openChat, content)
                Section.GALLERY -> GalleryScreen(
                    locale = locale,
                    selectedCategory = category,
                    onCategory = { category = it },
                    works = works,
                    onOpen = { viewerWorkId = it.id },
                    modifier = content,
                )
                Section.CONTACT -> ContactScreen(locale, openContact, openBooking, openChat, content)
            }
        }

        if (viewerStart >= 0) {
            PhotoViewer(
                works = works,
                start = viewerStart,
                copy = copy,
                onClose = { viewerWorkId = null },
                onBook = { work -> openPage(SiteLinks.booking(catalog, lang, work.id)) },
            )
        }

        SnackbarHost(
            hostState = snackbar,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
                .padding(16.dp),
        )
    }
}

@Composable
private fun TopBar(
    logo: String,
    lang: Lang,
    onLang: (Lang) -> Unit,
    section: Section,
    labels: Labels,
    onSection: (Section) -> Unit,
) {
    Surface(color = MaterialTheme.colorScheme.background) {
        Column(Modifier.statusBarsPadding()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                AssetImage(
                    path = logo,
                    contentDescription = "KA Nails",
                    modifier = Modifier.size(width = 112.dp, height = 48.dp),
                    contentScale = ContentScale.Fit,
                    alignment = Alignment.CenterStart,
                )
                Spacer(Modifier.weight(1f))
                SingleChoiceSegmentedButtonRow {
                    Lang.entries.forEachIndexed { index, option ->
                        SegmentedButton(
                            selected = option == lang,
                            onClick = { onLang(option) },
                            shape = SegmentedButtonDefaults.itemShape(index, Lang.entries.size),
                            icon = {},
                            modifier = Modifier
                                .testTag("lang-${option.code}")
                                .semantics { contentDescription = appCopy(option).languageName },
                        ) {
                            Text(option.code.uppercase())
                        }
                    }
                }
            }
            PrimaryTabRow(
                selectedTabIndex = section.ordinal,
                containerColor = MaterialTheme.colorScheme.background,
            ) {
                Section.entries.forEach { option ->
                    Tab(
                        selected = option == section,
                        onClick = { onSection(option) },
                        modifier = Modifier.testTag("tab-${option.name.lowercase()}"),
                        text = {
                            Text(
                                when (option) {
                                    Section.SERVICES -> labels.services
                                    Section.GALLERY -> labels.gallery
                                    Section.CONTACT -> labels.contact
                                },
                            )
                        },
                    )
                }
            }
        }
    }
}
