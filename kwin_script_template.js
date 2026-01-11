/**
 * Checks if given window is on the current virtual desktop.
 * @param {KWin::XdgToplevelWindow|KWin::X11Window} client Window to inspect
 * @return {boolean} True if window is on the current desktop or on all desktops
 */
function isOnCurrentDesktop(client) {
    if (client.onAllDesktops) {
        return true;
    }
    if (workspace.currentDesktop !== undefined && client.desktops !== undefined ){
        return client.desktops.includes(workspace.currentDesktop);
    }
    return true; // fallback if API mismatch
}

/**
 * Find all windows matching the specified filters.
 * @param {string} clientClass Window class to match (exact match)
 * @param {string} clientCaption Window caption/title to match (regex, case-insensitive)
 * @param {string} clientClassRegex Window class regex pattern to match
 * @param {boolean} currentDesktopOnly If true, only include windows on current desktop
 * @return {Array<KWin::XdgToplevelWindow|KWin::X11Window>} Array of matching windows
 */
function findMatchingClients(clientClass, clientCaption, clientClassRegex, currentDesktopOnly) {
    var clients = workspace.windowList();
    var compareToCaption = new RegExp(clientCaption || '', 'i');
    var compareToClassRegex = clientClassRegex.length > 0 ? new RegExp(clientClassRegex) : null;
    var compareToClass = clientClass;
    var isCompareToClass = clientClass.length > 0;
    var isCompareToRegex = compareToClassRegex !== null;
    var matchingClients = [];

    for (var i = 0; i < clients.length; i++) {
        var client = clients[i];
        var classCompare = (isCompareToClass && client.resourceClass == compareToClass);
        var classRegexCompare = (isCompareToRegex && compareToClassRegex && compareToClassRegex.exec(client.resourceClass));
        var captionCompare = (!isCompareToClass && !isCompareToRegex && compareToCaption.exec(client.caption));
        if (classCompare || classRegexCompare || captionCompare) {
            if (currentDesktopOnly && !isOnCurrentDesktop(client)) {
                continue;
            }
            matchingClients.push(client);
        }
    }

    return matchingClients;
}

/**
 * Set the specified window as the active window.
 * @param {KWin::XdgToplevelWindow|KWin::X11Window} client Window to activate
 */
function setActiveClient(client){
    workspace.activeWindow = client;
}

/**
 * Activate a window matching the specified filters, or signal via D-Bus if no match found.
 * When multiple windows match, cycles through them based on current focus state.
 * @param {string} clientClass Window class to match (exact match)
 * @param {string} clientCaption Window caption/title to match (regex, case-insensitive)
 * @param {string} clientClassRegex Window class regex pattern to match
 * @param {boolean} toggle If true, minimize the window if it's already active
 * @param {boolean} currentDesktopOnly If true, only match windows on current desktop
 * @param {string} dbusAddr D-Bus address to signal if no windows found (empty string to disable)
 */
function kwinActivateClient(clientClass, clientCaption, clientClassRegex, toggle, currentDesktopOnly, dbusAddr) {
    var matchingClients = findMatchingClients(clientClass, clientCaption, clientClassRegex, currentDesktopOnly);

    if (matchingClients.length === 0) {
        if (dbusAddr) {
            callDBus(dbusAddr, '/org/jumpkwapp/Listener', 'org.jumpkwapp.Listener', 'ShouldLaunch', 'true');
        }
        return;
    }

    if (dbusAddr) {
        callDBus(dbusAddr, '/org/jumpkwapp/Listener', 'org.jumpkwapp.Listener', 'ShouldLaunch', 'false');
    }

    var activeWindow = workspace.activeWindow;

    if (matchingClients.length === 1) {
        var client = matchingClients[0];
        if (activeWindow !== client) {
            setActiveClient(client);
        } else if (toggle) {
            client.minimized = !client.minimized;
        }
    } else if (matchingClients.length > 1) {
        var activeIsMatching = false;
        for (var j = 0; j < matchingClients.length; j++) {
            if (activeWindow === matchingClients[j]) {
                activeIsMatching = true;
                break;
            }
        }

        matchingClients.sort(function (a, b) {
            return a.stackingOrder - b.stackingOrder;
        });

        if (activeIsMatching) {
            var nextClient = matchingClients[0];
            setActiveClient(nextClient);
        } else {
            var newestClient = matchingClients[matchingClients.length - 1];
            setActiveClient(newestClient);
        }
    }
}

kwinActivateClient('{{.ClassName}}', '{{.CaptionPattern}}', '{{.ClassRegex}}', {{if .Toggle}}true{{else}}false{{end}}, {{if .CurrentDesktopOnly}}true{{else}}false{{end}}, '{{.DBusAddress}}');
