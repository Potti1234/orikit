package dev.orikit.device

import android.app.Activity
import android.content.pm.PackageManager

class LocationPermissionClassifier {
    fun classify(activity: Activity, permission: String, requestedBefore: Boolean): String {
        if (activity.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED) {
            return "Granted"
        }

        return if (requestedBefore && !activity.shouldShowRequestPermissionRationale(permission)) {
            "DeniedPermanently"
        } else {
            "Denied"
        }
    }
}
