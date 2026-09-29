import Foundation
import SwiftUI
import UIKit

/// Kairo's own addresses. Plain values with no actor, so the web view's
/// delegate callbacks can ask about an address without hopping threads.
enum KairoAddress {
    static let baseDomain = "kairobookings.com"

    /// The front door: email and password, and it finds the salon. Nobody has
    /// to know their own address, so nobody can type the wrong one.
    ///
    /// The app used to open on "What is your Kairo address?". App Review typed
    /// something that was not a salon, landed on "No salon at this address",
    /// and — because the address was saved — every launch after that went
    /// straight back to the same page with no way out. Asking only for the
    /// email and password removes both halves of that.
    static let loginHost = "login.\(baseDomain)"
    static let frontDoor = URL(string: "https://\(loginHost)/")!

    /// One salon's own address: exactly one label in front of the base domain,
    /// and not one of the platform's own names.
    static func isSalonHost(_ candidate: String?) -> Bool {
        guard let h = candidate?.lowercased(), h.hasSuffix(".\(baseDomain)") else { return false }
        let label = String(h.dropLast(baseDomain.count + 1))
        guard !label.isEmpty, !label.contains("."),
              label.range(of: "^[a-z0-9-]+$", options: .regularExpression) != nil else { return false }
        return !["login", "www", "app", "api", "mail"].contains(label)
    }
}

/// What the app knows between launches: which salon this phone belongs to, and
/// whether the owner asked for a face unlock.
///
/// There is no password here and no token here. The session lives where it
/// already lived — in the web view's cookie store — so a phone that is stolen
/// gives up exactly what a stolen laptop gives up, and no more.
@MainActor
final class Session: ObservableObject {
    private enum Key {
        static let host = "kairo.host"
        static let lock = "kairo.lockEnabled"
    }

    /// e.g. "hairbysha.kairobookings.com". Empty until someone has signed in.
    @Published var host: String {
        didSet { UserDefaults.standard.set(host, forKey: Key.host) }
    }
    @Published var lockEnabled: Bool {
        didSet { UserDefaults.standard.set(lockEnabled, forKey: Key.lock) }
    }
    @Published var unlocked = false
    @Published var deviceToken: String?
    @Published var pushError: String?
    /// Set when a notification or a universal link should take the web view somewhere.
    @Published var pendingPath: String?

    init() {
        let saved = UserDefaults.standard.string(forKey: Key.host) ?? ""
        // Only a salon's own address is worth keeping. Anything else (an
        // address typed into an older version of the app, say) is dropped here
        // rather than loaded, so it can never come back as an error page.
        host = KairoAddress.isSalonHost(saved) ? saved.lowercased() : ""
        lockEnabled = UserDefaults.standard.bool(forKey: Key.lock)
    }

    var baseURL: URL? {
        guard !host.isEmpty, let url = URL(string: "https://\(host)/") else { return nil }
        return url
    }

    /// Where the app opens: the salon it is signed in to, or the front door.
    var startURL: URL { baseURL ?? KairoAddress.frontDoor }

    /// The front door handed us to a salon and it answered: that is this phone's salon now.
    func adopt(host candidate: String) {
        let h = candidate.lowercased()
        guard KairoAddress.isSalonHost(h), h != host else { return }
        host = h
    }

    func signOut() {
        host = ""
        unlocked = false
        deviceToken = nil
    }

    /// A universal link. Only a link to *this* salon is followed: a link to a
    /// different one is somebody else's booking page and belongs in Safari.
    func open(url: URL) {
        guard !host.isEmpty, let h = url.host?.lowercased(), h == host else {
            UIApplication.shared.open(url)
            return
        }
        pendingPath = url.path + (url.query.map { "?\($0)" } ?? "")
    }
}
