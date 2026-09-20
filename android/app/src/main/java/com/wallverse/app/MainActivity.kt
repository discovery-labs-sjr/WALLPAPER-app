package com.wallverse.app

import android.annotation.SuppressLint
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private var webView: WebView? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        try {
            val view = WebView(applicationContext)
            webView = view

            view.settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = false
                allowContentAccess = true
                setSupportZoom(false)
            }

            view.webViewClient = object : WebViewClient() {
                override fun onReceivedError(
                    view: WebView,
                    request: WebResourceRequest,
                    error: WebResourceError
                ) {
                    if (request.isForMainFrame) {
                        showConnectionError()
                    }
                }
            }
            view.webChromeClient = WebChromeClient()

            setContentView(view)
            view.loadUrl(BuildConfig.WALLVERSE_BASE_URL)
        } catch (error: Throwable) {
            showStartupError()
        }
    }

    private fun showConnectionError() {
        val message = TextView(this).apply {
            text = "WALLVERSE\n\nImpossible de charger le serveur pour le moment.\nVérifie ta connexion Internet puis réessaie."
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.rgb(2, 3, 10))
            textSize = 17f
            gravity = Gravity.CENTER
            setPadding(48, 48, 48, 48)
        }
        setContentView(message)
    }

    private fun showStartupError() {
        val message = TextView(this).apply {
            text = "WALLVERSE\n\nL'application n'a pas pu démarrer correctement.\nFerme puis relance l'application."
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.rgb(2, 3, 10))
            textSize = 17f
            gravity = Gravity.CENTER
            setPadding(48, 48, 48, 48)
        }
        setContentView(message)
    }

    override fun onDestroy() {
        webView?.apply {
            stopLoading()
            webChromeClient = null
            webViewClient = null
            destroy()
        }
        webView = null
        super.onDestroy()
    }

    @Deprecated("Deprecated in Android API; retained for WebView back navigation")
    override fun onBackPressed() {
        val view = webView
        if (view?.canGoBack() == true) view.goBack() else super.onBackPressed()
    }
}
