declare namespace dev.orikit.device {
  class LocationPermissionClassifier {
    constructor()
    classify(activity: android.app.Activity, permission: string, requestedBefore: boolean): string
  }
}
