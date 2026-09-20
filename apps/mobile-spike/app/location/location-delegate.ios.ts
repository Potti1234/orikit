@NativeClass()
export class OriKitLocationDelegate extends NSObject implements CLLocationManagerDelegate {
  static ObjCProtocols = [CLLocationManagerDelegate]

  authorizationObserver: AuthorizationObserver | undefined
  locationObserver: LocationObserver | undefined

  locationManagerDidChangeAuthorization(manager: CLLocationManager): void {
    this.authorizationObserver?.(manager.authorizationStatus)
  }

  locationManagerDidUpdateLocations(
    _manager: CLLocationManager,
    locations: NSArray<CLLocation>,
  ): void {
    const location = locations.lastObject
    if (location !== null) this.locationObserver?.onLocation(location)
  }

  locationManagerDidFailWithError(_manager: CLLocationManager, error: NSError): void {
    this.locationObserver?.onFailure(String(error.localizedDescription))
  }
}

export type AuthorizationObserver = (status: CLAuthorizationStatus) => void

export type LocationObserver = Readonly<{
  onLocation: (location: CLLocation) => void
  onFailure: (message: string) => void
}>
