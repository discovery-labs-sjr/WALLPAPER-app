package com.wallverse.app

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.view.Gravity
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.URLUtil
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
            val view = WebView(this)
            webView = view

            view.settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = false
                allowContentAccess = true
                setSupportZoom(false)
            }

            view.webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest
                ): Boolean {
                    if (!request.isForMainFrame) return false

                    val uri = request.url
                    val host = uri.host.orEmpty()
                    val appHost = Uri.parse(BuildConfig.WALLVERSE_BASE_URL).host.orEmpty()

                    if ((uri.scheme == "http" || uri.scheme == "https") && host == appHost) {
                        return false
                    }

                    return try {
                        startActivity(Intent(Intent.ACTION_VIEW, uri))
                        true
                    } catch (_: Exception) {
                        true
                    }
                }

                override fun onReceivedError(
                    view: WebView,
                    request: WebResourceRequest,
                    error: WebResourceError
                ) {
                    if (request.isForMainFrame) showConnectionError()
                }
            }

            view.webChromeClient = WebChromeClient()
            view.setDownloadListener(DownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
                downloadFile(url, userAgent, contentDisposition, mimeType)
            })

            setContentView(view)
            view.loadUrl(BuildConfig.WALLVERSE_BASE_URL)
        } catch (_: Throwable) {
            showStartupError()
        }
    }

    private fun downloadFile(
        url: String,
        userAgent: String?,
        contentDisposition: String?,
        mimeType: String?
    ) {
        try {
            val filename = URLUtil.guessFileName(url, contentDisposition, mimeType)
            val request = DownloadManager.Request(Uri.parse(url)).apply {
                setMimeType(mimeType ?: "application/octet-stream")
                setTitle(filename)
                setDescription("Téléchargement WALLVERSE")
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename)
                if (!userAgent.isNullOrBlank()) addRequestHeader("User-Agent", userAgent)

                val cookie = CookieManager.getInstance().getCookie(url)
                if (!cookie.isNullOrBlank()) addRequestHeader("Cookie", cookie)
            }

            val manager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            manager.enqueue(request)
        } catch (_: Exception) {
            showDownloadError()
        }
    }

    private fun showConnectionError() {
        showMessage(
            "WALLVERSE\n\nImpossible de charger le serveur pour le moment.\nVérifie ta connexion Internet puis réessaie."
        )
    }

    private fun showDownloadError() {
        showMessage("WALLVERSE\n\nLe téléchargement n'a pas pu démarrer.")
    }

    private fun showStartupError() {
        showMessage(
            "WALLVERSE\n\nL'application n'a pas pu démarrer correctement.\nFerme puis relance l'application."
        )
    }

    private fun showMessage(text: String) {
        val message = TextView(this).apply {
            this.text = text
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
