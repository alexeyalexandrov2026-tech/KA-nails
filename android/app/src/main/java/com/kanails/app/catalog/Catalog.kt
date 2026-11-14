package com.kanails.app.catalog

import java.util.Locale
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull

enum class Lang(val code: String) {
    EN("en"),
    RU("ru");

    companion object {
        fun fromCode(code: String?): Lang? = entries.firstOrNull { it.code == code }

        fun fromSystem(locale: Locale): Lang = if (locale.language == "ru") RU else EN
    }
}

/** The offline catalog, generated from the site's sources when the app is built. */
data class Catalog(
    val siteUrl: String,
    val factsSha256: String,
    val logo: String,
    val locales: Map<Lang, LocaleCatalog>,
) {
    operator fun get(lang: Lang): LocaleCatalog = locales.getValue(lang)
}

data class LocaleCatalog(
    val homePath: String,
    val bookPath: String,
    val labels: Labels,
    val services: List<Offer>,
    val addOns: List<Offer>,
    val menuNotes: List<String>,
    val channels: List<Channel>,
    val master: Master?,
    val categories: List<Category>,
    val works: List<Work>,
)

/** Copy taken from the site's dictionaries (lib/locales). */
data class Labels(
    val services: String,
    val gallery: String,
    val contact: String,
    val book: String,
    val chat: String,
    val chatPrivacy: String,
    val servicesEyebrow: String,
    val servicesTitle: String,
    val addOnsTitle: String,
    val menuNotesTitle: String,
    val channelsTitle: String,
    val masterTitle: String,
    val galleryTitle: String,
)

/** A service or add-on; [price] is formatted by the site's own priceText(). */
data class Offer(
    val id: String,
    val name: String,
    val description: String?,
    val duration: String?,
    val price: String,
    val amount: Double,
    val currency: String,
    val from: Boolean,
    val plus: Boolean,
)

data class Channel(val kind: String, val label: String, val display: String, val href: String)

data class Master(val name: String, val bio: String, val photo: String?, val photoAlt: String)

data class Category(val key: String, val label: String) {
    companion object {
        const val ALL = "All"
    }
}

data class Work(
    val id: String,
    val title: String,
    val category: String,
    val categoryLabel: String,
    val finish: String,
    val colorFamily: String,
    val notes: String,
    val alt: String,
    val width: Int,
    val height: Int,
    val thumb: String,
    val image: String,
)

/** Reads assets/catalog/catalog.json, written by android/tools/build-catalog.mjs. */
object CatalogParser {
    const val ASSET_PATH = "catalog/catalog.json"
    private const val SCHEMA = 1
    private val ASSET = Regex("^catalog/[\\w./-]+\\.webp$")
    private val SITE_PATH = Regex("^/(?:[a-z]+/)*$")

    fun parse(text: String): Catalog {
        val root = Json.parseToJsonElement(text).asObject("catalog")
        val schema = root.int("schema")
        require(schema == SCHEMA) { "Unsupported catalog schema $schema" }
        val siteUrl = root.string("siteUrl")
        require(
            siteUrl.startsWith("https://") && !siteUrl.endsWith("/") &&
                '?' !in siteUrl && '#' !in siteUrl && '@' !in siteUrl,
        ) { "siteUrl must be a plain https address: $siteUrl" }
        val locales = root.obj("locales")
        return Catalog(
            siteUrl = siteUrl,
            factsSha256 = root.string("factsSha256"),
            logo = asset(root.string("logo")),
            locales = Lang.entries.associateWith { locale(locales.obj(it.code)) },
        )
    }

    private fun locale(json: JsonObject): LocaleCatalog {
        val paths = json.obj("paths")
        val labels = json.obj("labels")
        val services = json.array("services").map { offer(it.asObject("service")) }
        require(services.isNotEmpty()) { "The service menu is empty" }
        val works = json.array("works").map { work(it.asObject("work")) }
        require(works.isNotEmpty()) { "The portfolio is empty" }
        return LocaleCatalog(
            homePath = sitePath(paths.string("home")),
            bookPath = sitePath(paths.string("book")),
            labels = Labels(
                services = labels.string("services"),
                gallery = labels.string("gallery"),
                contact = labels.string("contact"),
                book = labels.string("book"),
                chat = labels.string("chat"),
                chatPrivacy = labels.string("chatPrivacy"),
                servicesEyebrow = labels.string("servicesEyebrow"),
                servicesTitle = labels.string("servicesTitle"),
                addOnsTitle = labels.string("addOnsTitle"),
                menuNotesTitle = labels.string("menuNotesTitle"),
                channelsTitle = labels.string("channelsTitle"),
                masterTitle = labels.string("masterTitle"),
                galleryTitle = labels.string("galleryTitle"),
            ),
            services = services,
            addOns = json.array("addOns").map { offer(it.asObject("add-on")) },
            menuNotes = json.array("menuNotes").map { it.asText("menu note") },
            channels = json.array("channels").map { channel(it.asObject("channel")) },
            master = (json["master"] as? JsonObject)?.let {
                Master(
                    name = it.string("name"),
                    bio = it.string("bio"),
                    photo = it.optString("photo")?.let(::asset),
                    photoAlt = it.string("photoAlt"),
                )
            },
            categories = json.array("categories").map {
                val category = it.asObject("category")
                Category(category.string("key"), category.string("label"))
            },
            works = works,
        )
    }

    private fun offer(json: JsonObject) = Offer(
        id = json.string("id"),
        name = json.string("name"),
        description = json.optString("description"),
        duration = json.optString("duration"),
        price = json.string("price"),
        amount = json.double("amount"),
        currency = json.string("currency"),
        from = json.bool("from"),
        plus = json.bool("plus"),
    )

    private fun channel(json: JsonObject): Channel {
        val href = json.string("href")
        require(href.startsWith("tel:+") || href.startsWith("https://")) {
            "Unsupported contact link: $href"
        }
        return Channel(json.string("kind"), json.string("label"), json.string("display"), href)
    }

    private fun work(json: JsonObject) = Work(
        id = json.string("id"),
        title = json.string("title"),
        category = json.string("category"),
        categoryLabel = json.string("categoryLabel"),
        finish = json.string("finish"),
        colorFamily = json.string("colorFamily"),
        notes = json.string("notes"),
        alt = json.string("alt"),
        width = json.int("width"),
        height = json.int("height"),
        thumb = asset(json.string("thumb")),
        image = asset(json.string("image")),
    )

    private fun sitePath(value: String): String {
        require(SITE_PATH.matches(value)) { "Unexpected site path: $value" }
        return value
    }

    private fun asset(value: String): String {
        require(ASSET.matches(value) && ".." !in value) { "Unexpected asset path: $value" }
        return value
    }
}

private fun bad(message: String): Nothing = throw IllegalArgumentException(message)

private fun JsonElement.asObject(where: String): JsonObject =
    this as? JsonObject ?: bad("$where: expected an object")

private fun JsonElement.asText(where: String): String =
    (this as? JsonPrimitive)?.takeIf { it.isString && it.content.isNotBlank() }?.content
        ?: bad("$where: expected text")

private fun JsonObject.obj(key: String): JsonObject =
    this[key] as? JsonObject ?: bad("$key: expected an object")

private fun JsonObject.array(key: String): JsonArray =
    this[key] as? JsonArray ?: bad("$key: expected a list")

private fun JsonObject.optString(key: String): String? =
    (this[key] as? JsonPrimitive)?.takeIf { it.isString }?.content

private fun JsonObject.string(key: String): String =
    optString(key)?.takeIf { it.isNotBlank() } ?: bad("$key: expected text")

private fun JsonObject.int(key: String): Int =
    (this[key] as? JsonPrimitive)?.intOrNull ?: bad("$key: expected a whole number")

private fun JsonObject.double(key: String): Double =
    (this[key] as? JsonPrimitive)?.doubleOrNull ?: bad("$key: expected a number")

private fun JsonObject.bool(key: String): Boolean =
    (this[key] as? JsonPrimitive)?.booleanOrNull ?: bad("$key: expected true or false")
