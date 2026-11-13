package com.kanails.app.ui

import android.app.Activity
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
import com.kanails.app.catalog.Channel
import com.kanails.app.catalog.Labels
import com.kanails.app.catalog.LocaleCatalog
import com.kanails.app.catalog.Offer
import com.kanails.app.catalog.Work

private val CardShape = RoundedCornerShape(4.dp)
private val ScreenPadding = PaddingValues(16.dp)

@Composable
internal fun ServicesScreen(
    locale: LocaleCatalog,
    copy: AppCopy,
    onBook: () -> Unit,
    onChat: () -> Unit,
    modifier: Modifier,
) {
    val labels = locale.labels
    LazyColumn(
        modifier = modifier.testTag("services"),
        contentPadding = ScreenPadding,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Eyebrow(labels.servicesEyebrow)
                Text(labels.servicesTitle, style = MaterialTheme.typography.headlineMedium)
                Text(
                    copy.offlineNote,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(4.dp))
                ActionButtons(labels, onBook, onChat)
            }
        }
        items(locale.services, key = { it.id }) { OfferCard(it) }
        if (locale.addOns.isNotEmpty()) {
            item { SectionTitle(labels.addOnsTitle) }
            items(locale.addOns, key = { it.id }) { OfferCard(it) }
        }
        if (locale.menuNotes.isNotEmpty()) {
            item { SectionTitle(labels.menuNotesTitle) }
            items(locale.menuNotes) { note ->
                Text(
                    "• $note",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
internal fun GalleryScreen(
    locale: LocaleCatalog,
    selectedCategory: String,
    onCategory: (String) -> Unit,
    works: List<Work>,
    onOpen: (Work) -> Unit,
    modifier: Modifier,
) {
    LazyVerticalGrid(
        columns = GridCells.Adaptive(150.dp),
        modifier = modifier.testTag("gallery"),
        contentPadding = ScreenPadding,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(locale.labels.galleryTitle, style = MaterialTheme.typography.headlineMedium)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(locale.categories, key = { it.key }) { option ->
                        FilterChip(
                            selected = option.key == selectedCategory,
                            onClick = { onCategory(option.key) },
                            label = { Text(option.label) },
                            modifier = Modifier.testTag("category-${option.key}"),
                        )
                    }
                }
            }
        }
        items(works, key = { it.id }) { work ->
            Column(
                modifier = Modifier
                    .clip(CardShape)
                    .clickable { onOpen(work) }
                    .testTag("work-${work.id}"),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                AssetImage(
                    path = work.thumb,
                    contentDescription = work.alt,
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(work.width.toFloat() / work.height)
                        .clip(CardShape),
                )
                Text(
                    work.title,
                    style = MaterialTheme.typography.titleSmall,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    work.categoryLabel,
                    style = MaterialTheme.typography.labelMedium,
                    color = KaColors.RoseInk,
                )
            }
        }
    }
}

@Composable
internal fun PhotoViewer(
    works: List<Work>,
    start: Int,
    copy: AppCopy,
    onClose: () -> Unit,
    onBook: (Work) -> Unit,
) {
    BackHandler(onBack = onClose)
    // Light system-bar icons on the espresso background while the viewer is open.
    val view = LocalView.current
    DisposableEffect(view) {
        val window = (view.context as? Activity)?.window
        val bars = window?.let { WindowCompat.getInsetsController(it, view) }
        bars?.isAppearanceLightStatusBars = false
        bars?.isAppearanceLightNavigationBars = false
        onDispose {
            bars?.isAppearanceLightStatusBars = true
            bars?.isAppearanceLightNavigationBars = true
        }
    }
    val pager = rememberPagerState(initialPage = start) { works.size }
    val current = works[pager.currentPage.coerceIn(works.indices)]
    Surface(
        color = KaColors.Espresso,
        contentColor = KaColors.Cream,
        modifier = Modifier
            .fillMaxSize()
            .testTag("viewer"),
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.safeDrawing)
                .padding(16.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    copy.photoPosition(pager.currentPage + 1, works.size),
                    style = MaterialTheme.typography.labelLarge,
                    color = KaColors.CreamMuted,
                    modifier = Modifier.weight(1f),
                )
                TextButton(
                    onClick = onClose,
                    colors = ButtonDefaults.textButtonColors(contentColor = KaColors.Cream),
                    modifier = Modifier.testTag("viewer-close"),
                ) {
                    Text(copy.close)
                }
            }
            HorizontalPager(
                state = pager,
                key = { works[it].id },
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
            ) { page ->
                AssetImage(
                    path = works[page].image,
                    contentDescription = works[page].alt,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Fit,
                )
            }
            Spacer(Modifier.height(12.dp))
            Text(current.title, style = MaterialTheme.typography.titleLarge)
            Text(
                listOf(current.categoryLabel, current.finish, current.colorFamily)
                    .joinToString(" · "),
                style = MaterialTheme.typography.bodyMedium,
                color = KaColors.CreamMuted,
            )
            Text(
                current.notes,
                style = MaterialTheme.typography.bodySmall,
                color = KaColors.CreamMuted,
            )
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = { onBook(current) },
                colors = ButtonDefaults.buttonColors(
                    containerColor = KaColors.Cream,
                    contentColor = KaColors.Espresso,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("viewer-book"),
            ) {
                Text(copy.bookLook)
            }
        }
    }
}

@Composable
internal fun ContactScreen(
    locale: LocaleCatalog,
    onContact: (Channel) -> Unit,
    onBook: () -> Unit,
    onChat: () -> Unit,
    modifier: Modifier,
) {
    val labels = locale.labels
    LazyColumn(
        modifier = modifier.testTag("contact"),
        contentPadding = ScreenPadding,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { Text(labels.channelsTitle, style = MaterialTheme.typography.headlineMedium) }
        items(locale.channels, key = { "${it.kind}:${it.href}" }) { channel ->
            Surface(
                onClick = { onContact(channel) },
                shape = CardShape,
                color = KaColors.Paper,
                border = BorderStroke(1.dp, KaColors.Hairline),
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("channel-${channel.kind}"),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Eyebrow(channel.label)
                    Text(channel.display, style = MaterialTheme.typography.titleLarge)
                }
            }
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                ActionButtons(labels, onBook, onChat)
                Text(
                    labels.chatPrivacy,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        val master = locale.master
        if (master != null) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    SectionTitle(labels.masterTitle)
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        if (master.photo != null) {
                            AssetImage(
                                path = master.photo,
                                contentDescription = master.photoAlt,
                                modifier = Modifier
                                    .size(96.dp)
                                    .clip(CircleShape),
                            )
                        }
                        Text(master.name, style = MaterialTheme.typography.titleLarge)
                    }
                    Text(
                        master.bio,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun ActionButtons(labels: Labels, onBook: () -> Unit, onChat: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(
            onClick = onBook,
            modifier = Modifier
                .fillMaxWidth()
                .testTag("book-button"),
        ) {
            Text(labels.book)
        }
        OutlinedButton(
            onClick = onChat,
            modifier = Modifier
                .fillMaxWidth()
                .testTag("chat-button"),
        ) {
            Text(labels.chat)
        }
    }
}

@Composable
private fun OfferCard(offer: Offer) {
    Surface(
        shape = CardShape,
        color = KaColors.Paper,
        border = BorderStroke(1.dp, KaColors.Hairline),
        modifier = Modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) {}
            .testTag("offer-${offer.id}"),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Text(
                    offer.name,
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(12.dp))
                Text(
                    offer.price,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
            }
            offer.description?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            offer.duration?.let {
                Text(it, style = MaterialTheme.typography.labelMedium, color = KaColors.RoseInk)
            }
        }
    }
}

@Composable
private fun Eyebrow(text: String) {
    Text(
        text.uppercase(),
        style = MaterialTheme.typography.labelMedium.copy(letterSpacing = 1.6.sp),
        color = KaColors.RoseInk,
    )
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.headlineSmall,
        modifier = Modifier.padding(top = 12.dp),
    )
}
