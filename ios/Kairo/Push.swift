import Foundation
import UIKit
import UserNotifications

/// Asking for notifications, at the only moment it is fair to ask.
enum Push {
    /// Called when the workspace says somebody signed in — never on first launch.
    ///
    /// Returns what the owner's iPhone allows, in the page's words ("allowed",
    /// "denied"), so Settings in Kairo can say why nothing arrives instead of
    /// guessing.
    @MainActor
    @discardableResult
    static func ask() async -> String {
        let centre = UNUserNotificationCenter.current()
        let settings = await centre.notificationSettings()
        switch settings.authorizationStatus {
        case .notDetermined:
            let granted = (try? await centre.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
            if granted { UIApplication.shared.registerForRemoteNotifications() }
            return granted ? "allowed" : "denied"
        case .authorized, .provisional, .ephemeral:
            // Already said yes: re-register, because a token can change after a
            // restore or an iOS upgrade and a stale one silently sends nowhere.
            UIApplication.shared.registerForRemoteNotifications()
            return "allowed"
        default:
            return "denied"
        }
    }
}
