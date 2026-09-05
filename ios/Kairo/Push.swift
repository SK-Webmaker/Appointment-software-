import Foundation
import UIKit
import UserNotifications

/// Asking for notifications, at the only moment it is fair to ask.
enum Push {
    /// Called when the workspace says somebody signed in — never on first launch.
    @MainActor
    static func ask() async {
        let centre = UNUserNotificationCenter.current()
        let settings = await centre.notificationSettings()
        switch settings.authorizationStatus {
        case .notDetermined:
            let granted = (try? await centre.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
            if granted { UIApplication.shared.registerForRemoteNotifications() }
        case .authorized, .provisional, .ephemeral:
            // Already said yes: re-register, because a token can change after a
            // restore or an iOS upgrade and a stale one silently sends nowhere.
            UIApplication.shared.registerForRemoteNotifications()
        default:
            break
        }
    }
}
