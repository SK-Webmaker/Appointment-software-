import Foundation
import LocalAuthentication

/// Face ID in front of the workspace.
///
/// A salon's phone sits on the counter all day, and the book has every client's
/// number and notes in it. This is off by default and the owner turns it on:
/// making it mandatory would mean a phone that cannot open the book when Face
/// ID fails in a dark salon, which is worse than the risk it removes.
enum Lock {
    static var available: Bool {
        var error: NSError?
        return LAContext().canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)
    }

    /// `.deviceOwnerAuthentication`, not `...WithBiometrics`: a passcode must
    /// still get in, or a cracked screen locks the owner out of their own book.
    static func unlock(reason: String = "Unlock Kairo") async -> Bool {
        let context = LAContext()
        context.localizedFallbackTitle = "Use passcode"
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: nil) else { return true }
        return (try? await context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason)) ?? false
    }
}
