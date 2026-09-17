plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.wallverse.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.wallverse.app"
        minSdk = 23
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"

        buildConfigField("String", "WALLVERSE_BASE_URL", "\"${project.findProperty("WALLVERSE_BASE_URL") ?: "https://YOUR-WALLVERSE-DOMAIN.example"}\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
}
