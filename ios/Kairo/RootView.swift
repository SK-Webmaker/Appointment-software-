import SwiftUI

/// Two states, and only two: prove it is you, and the book.
///
/// There is no native "which salon?" screen any more. A phone that is not signed
/// in opens on the front door — email and password, the same as on a computer —
/// and the front door finds the salon. One web view carries both, so signing in
/// is a page turning over, not the app rebuilding itself underneath the owner.
struct RootView: View {
    @EnvironmentObject var session: Session
    @Environment(\.scenePhase) private var phase

    var body: some View {
        Group {
            if session.lockEnabled && !session.unlocked && session.baseURL != nil {
                LockScreen()
            } else {
                KairoWebView()
                    .ignoresSafeArea(edges: .bottom)
            }
        }
        .onChange(of: phase) { _, newPhase in
            // Locked again the moment it leaves the foreground, so handing the
            // phone to somebody to look at a photo does not hand them the book.
            if newPhase != .active && session.lockEnabled { session.unlocked = false }
        }
    }
}

private struct LockScreen: View {
    @EnvironmentObject var session: Session
    @State private var refused = false

    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: "lock.fill").font(.system(size: 44)).foregroundStyle(.secondary)
            Text("Kairo is locked").font(.headline)
            if refused {
                Button("Try again") { Task { await unlock() } }
                    .buttonStyle(.borderedProminent)
            }
        }
        .task { await unlock() }
    }

    private func unlock() async {
        let ok = await Lock.unlock()
        session.unlocked = ok
        refused = !ok
    }
}
