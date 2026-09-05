import SwiftUI
import UIKit
import UserNotifications

/// Kairo on the phone.
///
/// This is deliberately a shell around the same Kairo the browser loads, not a
/// second client. A native rewrite would mean every feature built twice and
/// two things to keep in step forever, and the salon owner would still be
/// waiting for the second one. What the shell adds is the four things a web
/// page genuinely cannot do: wake the phone when somebody books, unlock with a
/// face, open a booking link in the app, and sit on the home screen.
@main
struct KairoApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @StateObject private var session = Session()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .onOpenURL { session.open(url: $0) }
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                    if let url = activity.webpageURL { session.open(url: url) }
                }
                .task { delegate.session = session }
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    weak var session: Session?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    /// Apple has given us a token for this phone. It is handed to the web view
    /// rather than posted from here, so the salon's own session cookie carries
    /// it — the app never holds a credential of its own.
    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        MainActor.assumeIsolated { session?.deviceToken = hex }
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // Not fatal and not worth a dialog: the app works without push, and the
        // checklist in the workspace already says whether a phone is signed in.
        let detail = error.localizedDescription
        MainActor.assumeIsolated { session?.pushError = detail }
    }

    /// A booking arriving while the owner is looking at the app should still be
    /// visible — silently swallowing it is how people stop trusting the badge.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .list]
    }

    /// Tapping a notification goes to the day it is about.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse) async {
        let info = response.notification.request.content.userInfo
        if let date = info["date"] as? String {
            await MainActor.run { session?.pendingPath = "/#/calendar?date=\(date)" }
        }
    }
}
