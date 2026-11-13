import javax.inject.Inject
import org.gradle.process.ExecOperations

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

/**
 * Builds the offline catalog (services, prices, contacts, portfolio photos and
 * the launcher icon) from the site's sources with android/tools/build-catalog.mjs.
 * Nothing it writes is committed, so the site stays the only place to edit.
 */
abstract class GenerateKaCatalog : DefaultTask() {
    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val siteSources: ConfigurableFileCollection

    @get:Internal
    abstract val siteRoot: DirectoryProperty

    @get:Input
    abstract val node: Property<String>

    /** lib/site.ts reads it, so it changes the generated site address. */
    @get:Input
    @get:Optional
    abstract val siteUrlOverride: Property<String>

    @get:OutputDirectory
    abstract val assetsDir: DirectoryProperty

    @get:OutputDirectory
    abstract val resDir: DirectoryProperty

    @get:Inject
    abstract val execOperations: ExecOperations

    @TaskAction
    fun generate() {
        val site = siteRoot.get().asFile
        execOperations.exec {
            workingDir = site
            commandLine(
                node.get(),
                site.resolve("android/tools/build-catalog.mjs").absolutePath,
                "--site", site.absolutePath,
                "--assets", assetsDir.get().asFile.absolutePath,
                "--res", resDir.get().asFile.absolutePath,
            )
        }
    }
}

val siteRootDir: Directory = layout.projectDirectory.dir(rootDir.parentFile.canonicalPath)
val nodeExecutable: Provider<String> = providers.gradleProperty("ka.node")
    .orElse(providers.environmentVariable("KA_NODE"))
    .orElse("node")

android {
    namespace = "com.kanails.app"
    compileSdk = 37

    defaultConfig {
        // Not final: confirm the application ID before the first Play upload.
        applicationId = "com.kanails.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            // R8 shrinks and optimizes Compose; debug builds start several times slower.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
        }
    }

    buildFeatures {
        compose = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    androidResources {
        localeFilters += listOf("en", "ru")
    }

    lint {
        abortOnError = true
    }
}

androidComponents {
    onVariants { variant ->
        val name = variant.name.replaceFirstChar(Char::uppercase)
        val catalog = tasks.register<GenerateKaCatalog>("generate${name}KaCatalog") {
            siteRoot.set(siteRootDir)
            siteSources.from(
                siteRootDir.file("android/tools/build-catalog.mjs"),
                siteRootDir.file("content/studio-facts.json"),
                siteRootDir.dir("lib"),
                siteRootDir.dir("public/photos"),
                siteRootDir.file("public/assets/ka-nails-logo-320.webp"),
                siteRootDir.file("public/icons/icon-192.png"),
                siteRootDir.file("node_modules/typescript/package.json"),
            )
            node.set(nodeExecutable)
            siteUrlOverride.set(providers.environmentVariable("NEXT_PUBLIC_SITE_URL"))
        }
        variant.sources.assets?.addGeneratedSourceDirectory(catalog, GenerateKaCatalog::assetsDir)
        variant.sources.res?.addGeneratedSourceDirectory(catalog, GenerateKaCatalog::resDir)

        // Unit tests check the generated catalog against the site's own files.
        val catalogDir = catalog.flatMap { it.assetsDir }
        val factsFile = siteRootDir.file("content/studio-facts.json").asFile.absolutePath
        tasks.withType<Test>().matching { it.name == "test${name}UnitTest" }.configureEach {
            inputs.dir(catalogDir).withPathSensitivity(PathSensitivity.RELATIVE)
                .withPropertyName("kaCatalog")
            jvmArgumentProviders.add(
                CommandLineArgumentProvider {
                    listOf(
                        "-Dka.catalog.dir=${catalogDir.get().asFile.absolutePath}",
                        "-Dka.facts.file=$factsFile",
                    )
                },
            )
        }
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2026.09.00")
    implementation(composeBom)
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.browser:browser:1.10.0")
    implementation("androidx.core:core-ktx:1.19.1")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.13.0")

    testImplementation("junit:junit:4.13.2")

    androidTestImplementation(composeBom)
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test:runner:1.7.0")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
