import Foundation
import SwiftUI
import UIKit

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

    /// e.g. "hairbysha.kairobookings.com". Empty until the owner says who they are.
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
        host = UserDefaults.standard.string(forKey: Key.host) ?? ""
        lockEnabled = UserDefaults.standard.bool(forKey: Key.lock)
    }

    var baseURL: URL? {
        guard !host.isEmpty, let url = URL(string: "https://\(host)/") else { return nil }
        return url
    }

    /// The address the owner typed, reduced to a hostname.
    ///
    /// People type "Hair By Sha", "hairbysha.kairobookings.com",
    /// "https://hairbysha.kairobookings.com/" and "hairbysha". All four mean
    /// the same salon, and refusing three of them teaches nobody anything.
    static func normalise(_ typed: String) -> String? {
        var s = typed.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if s.isEmpty { return nil }
        if let r = s.range(of: "://") { s = String(s[r.upperBound...]) }
        s = s.split(separator: "/").first.map(String.init) ?? s
        if s.hasSuffix(".") { s.removeLast() }
        if !s.contains(".") {
            // A bare name is a slug on the platform's own domain.
            s = s.replacingOccurrences(of: " ", with: "")
            s = s.filter { $0.isLetter || $0.isNumber || $0 == "-" }
            guard !s.isEmpty else { return nil }
            return "\(s).kairobookings.com"
        }
        guard s.contains("."), !s.contains(" "),
              s.range(of: "^[a-z0-9.-]+$", options: .regularExpression) != nil else { return nil }
        return s
    }

    func sign(in typed: String) -> Bool {
        guard let h = Session.normalise(typed) else { return false }
        host = h
        return true
    }

    func signOut() {
        host = ""
        unlocked = false
        deviceToken = nil
    }

    /// A universal link. Only a link to *this* salon is followed: a link to a
    /// different one is somebody else's booking page and belongs in Safari.
    func open(url: URL) {
        guard let h = url.host, h == host else {
            UIApplication.shared.open(url)
            return
        }
        pendingPath = url.path + (url.query.map { "?\($0)" } ?? "")
    }
}
