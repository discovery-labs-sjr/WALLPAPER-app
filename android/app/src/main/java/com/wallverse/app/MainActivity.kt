package com.wallverse.app

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.DownloadListener
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.allowFileAccess = false
            settings.allowContentAccess = true
            settings.setSupportZoom(false)
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val url = request.url.toString()
                    return if (url.startsWith("https://") || url.startsWith("http://")) {
                        false
                    } else {
                        startActivity(Intent(Intent.ACTION_VIEW, request.url))
                        true
                    }
                }
            }
            webChromeClient = WebChromeClient()
            setDownloadListener(DownloadListener { url, _, _, _, _ ->
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            })
        }

        setContentView(webView)
        webView.loadUrl(BuildConfig.WALLVERSE_BASE_URL)
    }

    @Deprecated("Deprecated in Android API; retained for WebView back navigation")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
