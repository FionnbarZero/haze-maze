# GitHub account migration note

Moonhollow currently lives in a family member's GitHub account. Development can continue there until its creator has a personal GitHub account. At that point, transfer the existing `haze-maze` repository rather than creating a second copy. A transfer preserves the repository history and collaborators.

Before transferring, create the new account and confirm it has no repository named `haze-maze`. From the current repository owner's account, use **Settings** → **General** → **Danger Zone** → **Transfer**, choose the new account, and accept the invitation from that account within one day.

After transfer, reconnect GitHub Pages, verify the `moonhollow.fionnstudio.com` custom domain, update this Mac's Git remote, make a small test push, and test the public game in a fresh browser. GitHub redirects old repository links, but GitHub Pages must be checked separately. The transfer is complete only when the new account owns `haze-maze`, this Mac pushes there, and the public Moonhollow address serves the current game.
