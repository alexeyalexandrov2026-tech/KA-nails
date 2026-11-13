package com.kanails.app.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import com.kanails.app.R

/** Brand colours from app/globals.css (:root, "brand luxe"). */
object KaColors {
    val Cream = Color(0xFFFDF8F2)
    val CreamDeep = Color(0xFFF4ECE2)
    val Paper = Color(0xFFFFFCF7)
    val Espresso = Color(0xFF261B15)
    val EspressoRaised = Color(0xFF3A2A21)
    val SoftInk = Color(0xFF655951)
    val RoseInk = Color(0xFF7E5F4E)
    val CreamMuted = Color(0xFFD9CCC0)
    val Hairline = Color(0xFFE3D5C8)
    val Control = Color(0xFF756459)
}

private val colors = lightColorScheme(
    primary = KaColors.Espresso,
    onPrimary = KaColors.Cream,
    primaryContainer = KaColors.CreamDeep,
    onPrimaryContainer = KaColors.Espresso,
    secondary = KaColors.RoseInk,
    onSecondary = KaColors.Paper,
    secondaryContainer = KaColors.CreamDeep,
    onSecondaryContainer = KaColors.Espresso,
    background = KaColors.Cream,
    onBackground = KaColors.Espresso,
    surface = KaColors.Cream,
    onSurface = KaColors.Espresso,
    surfaceVariant = KaColors.CreamDeep,
    onSurfaceVariant = KaColors.SoftInk,
    surfaceContainerLow = KaColors.Paper,
    surfaceContainer = KaColors.CreamDeep,
    surfaceContainerHigh = KaColors.CreamDeep,
    outline = KaColors.Control,
    outlineVariant = KaColors.Hairline,
)

// Headings use Cormorant Garamond like the site: the variable TTF from
// google/fonts (SIL OFL 1.1, assets/licenses/cormorant-garamond-OFL.txt).
private fun cormorant(weight: FontWeight) = Font(
    R.font.cormorant_garamond,
    weight = weight,
    variationSettings = FontVariation.Settings(FontVariation.weight(weight.weight)),
)

private val base = Typography()
private val serif = FontFamily(
    cormorant(FontWeight.Normal),
    cormorant(FontWeight.Medium),
    cormorant(FontWeight.SemiBold),
)
private val typography = base.copy(
    displaySmall = base.displaySmall.copy(fontFamily = serif),
    headlineLarge = base.headlineLarge.copy(fontFamily = serif),
    headlineMedium = base.headlineMedium.copy(fontFamily = serif),
    headlineSmall = base.headlineSmall.copy(fontFamily = serif),
    titleLarge = base.titleLarge.copy(fontFamily = serif, fontWeight = FontWeight.SemiBold),
    titleMedium = base.titleMedium.copy(fontFamily = serif, fontWeight = FontWeight.SemiBold),
)

@Composable
fun KaTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = colors, typography = typography, content = content)
}
