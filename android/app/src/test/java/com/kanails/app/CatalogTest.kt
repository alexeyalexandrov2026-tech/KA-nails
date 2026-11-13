package com.kanails.app

import com.kanails.app.catalog.Catalog
import com.kanails.app.catalog.CatalogParser
import com.kanails.app.catalog.Lang
import com.kanails.app.links.SiteLinks
import java.io.File
import java.security.MessageDigest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.double
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

/** Set by app/build.gradle.kts: the generated assets and the site's studio facts. */
private val catalogDir by lazy {
    File(requireNotNull(System.getProperty("ka.catalog.dir")) { "Run through Gradle" })
}
private val factsFile by lazy {
    File(requireNotNull(System.getProperty("ka.facts.file")) { "Run through Gradle" })
}
private val generated: Catalog by lazy {
    CatalogParser.parse(File(catalogDir, CatalogParser.ASSET_PATH).readText())
}

private fun JsonObject.text(key: String) = getValue(key).jsonPrimitive.content

class CatalogTest {
    private val facts by lazy { Json.parseToJsonElement(factsFile.readText()).jsonObject }

    @Test
    fun `catalog is built from the current studio facts`() {
        val digest = MessageDigest.getInstance("SHA-256").digest(factsFile.readBytes())
        assertEquals(digest.joinToString("") { "%02x".format(it) }, generated.factsSha256)
    }

    @Test
    fun `services and add-ons follow studio-facts json in both languages`() {
        for (field in listOf("services", "addOns")) {
            val source = facts.getValue(field).jsonArray.map { it.jsonObject }
            for (lang in Lang.entries) {
                val locale = generated[lang]
                val offers = if (field == "services") locale.services else locale.addOns
                assertEquals(source.map { it.text("id") }, offers.map { it.id })
                source.zip(offers).forEach { (raw, offer) ->
                    val price = raw.getValue("price").jsonObject
                    assertEquals(raw.getValue("name").jsonObject.text(lang.code), offer.name)
                    assertEquals(
                        raw["description"]?.jsonObject?.text(lang.code),
                        offer.description,
                    )
                    assertEquals(price.getValue("amount").jsonPrimitive.double, offer.amount, 0.0)
                    assertEquals(price.text("currency"), offer.currency)
                    assertEquals(price["plus"]?.jsonPrimitive?.boolean ?: false, offer.plus)
                    assertEquals(price["from"]?.jsonPrimitive?.boolean ?: false, offer.from)
                }
            }
        }
    }

    @Test
    fun `prices keep the site's format and markers`() {
        val space = "[\\u00a0\\u202f ]"
        val formats = mapOf(
            Lang.EN to Regex("^(from |\\+)?\\$\\d+(\\.\\d{2})?$"),
            Lang.RU to Regex("^(от |\\+)?\\d+(,\\d{2})?$space\\$$"),
        )
        val fromWord = mapOf(Lang.EN to "from ", Lang.RU to "от ")
        for (lang in Lang.entries) {
            val offers = generated[lang].services + generated[lang].addOns
            offers.filter { it.currency == "USD" }.forEach { offer ->
                val label = "${lang.code} ${offer.id}: '${offer.price}'"
                assertTrue(label, formats.getValue(lang).matches(offer.price))
                assertEquals(label, offer.plus, offer.price.startsWith("+"))
                assertEquals(label, offer.from, offer.price.startsWith(fromWord.getValue(lang)))
            }
        }
    }

    @Test
    fun `russian names are translated`() {
        val cyrillic = Regex("[А-Яа-яЁё]")
        val ru = generated[Lang.RU]
        (ru.services + ru.addOns).forEach { assertTrue(it.name, cyrillic.containsMatchIn(it.name)) }
        val en = generated[Lang.EN]
        (en.services + en.addOns).forEach { assertFalse(it.name, cyrillic.containsMatchIn(it.name)) }
    }

    @Test
    fun `portfolio matches in both languages and every image is packaged`() {
        val en = generated[Lang.EN].works
        val ru = generated[Lang.RU].works
        assertTrue(en.isNotEmpty())
        assertEquals(en.map { it.id }, ru.map { it.id })
        assertEquals(en.map { it.image }, ru.map { it.image })
        en.zip(ru).forEach { (e, r) -> assertNotEquals(e.id, e.alt, r.alt) }
        val images = buildList {
            add(generated.logo)
            Lang.entries.forEach { lang ->
                generated[lang].works.forEach { add(it.thumb); add(it.image) }
                generated[lang].master?.photo?.let(::add)
            }
        }
        images.forEach {
            val file = File(catalogDir, it)
            assertTrue("missing $it", file.isFile && file.length() > 0)
        }
    }

    @Test
    fun `contacts are the site's public channels`() {
        val numbers = facts.getValue("channels").jsonArray
            .map { it.jsonObject.text("value").removePrefix("+") }
        for (lang in Lang.entries) {
            val channels = generated[lang].channels
            assertEquals(numbers.size, channels.size)
            channels.forEach { channel ->
                assertTrue(channel.href, numbers.any { channel.href.endsWith(it) })
            }
        }
    }
}

class SiteLinksTest {
    @Test
    fun `booking opens the localized site page`() {
        assertTrue(generated.siteUrl.startsWith("https://"))
        assertEquals("${generated.siteUrl}/book/", SiteLinks.booking(generated, Lang.EN))
        assertEquals("${generated.siteUrl}/ru/book/", SiteLinks.booking(generated, Lang.RU))
    }

    @Test
    fun `a portfolio look goes through the site's look parameter`() {
        val id = generated[Lang.RU].works.first().id
        assertEquals(
            "${generated.siteUrl}/ru/book/?look=$id",
            SiteLinks.booking(generated, Lang.RU, id),
        )
    }

    @Test
    fun `unknown or malformed looks are dropped`() {
        listOf("work-99", "work-1", "../work-01", "work-01&service=x", "work-01#x", "").forEach {
            assertEquals(it, "${generated.siteUrl}/book/", SiteLinks.booking(generated, Lang.EN, it))
        }
    }

    @Test
    fun `chat opens the home page where the site's assistant lives`() {
        assertEquals("${generated.siteUrl}/", SiteLinks.chat(generated, Lang.EN))
        assertEquals("${generated.siteUrl}/ru/", SiteLinks.chat(generated, Lang.RU))
    }

    @Test
    fun `parser rejects an unknown schema and an unsafe site address`() {
        listOf(
            """{"schema":2}""",
            """{"schema":1,"siteUrl":"http://ka-nails.pages.dev"}""",
            """{"schema":1,"siteUrl":"https://ka-nails.pages.dev/?x=1"}""",
            """{"schema":1,"siteUrl":"https://user@ka-nails.pages.dev"}""",
        ).forEach { json ->
            assertThrows(json, IllegalArgumentException::class.java) { CatalogParser.parse(json) }
        }
    }
}
