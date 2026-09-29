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
        versionCode = 2
        versionName = "1.1.0"

        // The Android client talks to the public WALLVERSE web application.
        // Keep the URL centralized here so the mobile shell and backend stay decoupled.
        buildConfigField("String", "WALLVERSE_BASE_URL", "\"https://wallpaper-app-bw12.onrender.com\"")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
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
