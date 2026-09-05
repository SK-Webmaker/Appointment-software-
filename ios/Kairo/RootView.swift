import SwiftUI

/// Three states, and only three: tell us which salon, prove it is you, and the
/// book. Anything else on the launch path is a screen between an owner and a
/// client standing in front of them.
struct RootView: View {
    @EnvironmentObject var session: Session
    @Environment(\.scenePhase) private var phase

    var body: some View {
        Group {
            if let url = session.baseURL {
                if session.lockEnabled && !session.unlocked {
                    LockScreen()
                } else {
                    KairoWebView(url: url)
                        .ignoresSafeArea(edges: .bottom)
                }
            } else {
                SignInScreen()
            }
        }
        .onChange(of: phase) { _, newPhase in
            // Locked again the moment it leaves the foreground, so handing the
            // phone to somebody to look at a photo does not hand them the book.
            if newPhase != .active && session.lockEnabled { session.unlocked = false }
        }
    }
}

private struct SignInScreen: View {
    @EnvironmentObject var session: Session
    @State private var typed = ""
    @State private var wrong = false
    @FocusState private var focused: Bool

    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            Text("Kairo").font(.system(size: 40, weight: .semibold, design: .rounded))
            Text("What is your Kairo address?")
                .font(.headline).foregroundStyle(.secondary)
            TextField("yoursalon", text: $typed)
                .textFieldStyle(.roundedBorder)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.URL)
                .focused($focused)
                .onSubmit(go)
            Text("Just your name is enough — we add the rest.")
                .font(.footnote).foregroundStyle(.secondary)
            if wrong {
                Text("That does not look like an address.")
                    .font(.footnote).foregroundStyle(.red)
            }
            Button("Continue", action: go)
                .buttonStyle(.borderedProminent)
                .disabled(typed.trimmingCharacters(in: .whitespaces).isEmpty)
            Spacer()
            Text("You sign in on the next screen, the same way you do on a computer.")
                .font(.caption).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(28)
        .onAppear { focused = true }
    }

    private func go() {
        wrong = !session.sign(in: typed)
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
