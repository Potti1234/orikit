import CoreLocation
import CoreMotion
import Foundation
import UIKit

@objcMembers
public class OriKitNativeGreeting: NSObject {
    public func value() -> String {
        return "Hello from Swift \(UIDevice.current.model)"
    }
}
