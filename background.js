// --------------- Log Stuff --------------- //

function logs(message) {
    var today = new Date();
    var date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    var logTime = "[" + date + " " + time + "] "
    console.log(logTime + message)
}


// --------------- Context Menu Ticket Viewer --------------- //

function viewTickets() {
    chrome.tabs.create({
        url: "https://openbanking.atlassian.net/secure/Dashboard.jspa?selectPageId=12630"
    });
}

chrome.contextMenus.create({
    id: "otsdashboard",
    title: "OTS Dashboard",
    type: "normal",
    contexts: ["browser_action"],
    visible: true
});

chrome.contextMenus.create({
    id: "newqueuenotifier",
    title: "Queue Notifier",
    type: "checkbox",
    contexts: ["browser_action"],
    visible: true
});

chrome.contextMenus.onClicked.addListener(function (info, tab) {
    if (info.menuItemId === "otsdashboard") {
        viewTickets()
        logs('Clicked "View Tickets" button.')
    }
    if (info.menuItemId === "newqueuenotifier") {
        var storage = window.localStorage;

        var user = storage.getItem("user");
        var key = storage.getItem("key");

        if (info.checked && (key !== null && user !== null)) {
            searchLoop(true)
        } else {
            searchLoop(false)
            chrome.contextMenus.update(
                "newqueuenotifier", {
                    checked: false
                }
            );
            chrome.browserAction.setBadgeText({
                text: ""
            });
        }
    }
});

// --------------- Notification Banner Function --------------- //

function newTicketsNotification(logMessage, silentNotify) {
    if (silentNotify) {
        return false;
    }

    if (Notification.permission !== 'granted') {
        Notification.requestPermission();
    } else {
        var notification = new Notification("OTS Tools", {
            icon: "/pics/ots_icon_128.png",
            body: logMessage,
        });
        notification.onclick = function () {
            viewTickets()
        };
        notification.onshow = function () {
            logs("Notification displayed: " + logMessage)
        };
    }
}


// --------------- Set Previous Ticket State --------------- //

var prevTicketState = false


// --------------- New Ticket Badge --------------- //

function newTicketsBadge(ticketNumbers) {
    if (ticketNumbers > 0) {
        if (!prevTicketState) {
            prevTicketState = true
            newTicketsNotification("New tickets in the queue!")
        }
        chrome.browserAction.setBadgeText({
            text: String(ticketNumbers)
        });
        chrome.browserAction.setBadgeBackgroundColor({
            color: [255, 0, 0, 255]
        });
    } else {
        if (prevTicketState) {
            prevTicketState = false
            newTicketsNotification("No new tickets.")
        }
        chrome.browserAction.setBadgeText({
            text: ""
        });
    }
}

function newTicketsNotifier(ticketNumbers) {
    var today = new Date();
    var hour = today.getHours();
    var silentNotify = true;

    if (!(hour > 8 && hour > 18)) {
        silentNotify = false
    }

    if (ticketNumbers > 0) {
        if (!prevTicketState) {
            prevTicketState = true
            newTicketsNotification("New tickets in the queue!", silentNotify)
        }
        chrome.browserAction.setBadgeText({
            text: String(ticketNumbers)
        });
        chrome.browserAction.setBadgeBackgroundColor({
            color: [255, 0, 0, 255]
        });
    } else {
        if (prevTicketState) {
            prevTicketState = false
            newTicketsNotification("No new tickets.", silentNotify)
        }
        chrome.browserAction.setBadgeText({
            text: ""
        });
    }
}
// --------------- Ticket Searcher Loop --------------- //

function newTicketsSearch() {
    var storage = window.localStorage;

    var active = storage.getItem("activated");

    var user = storage.getItem("user");
    var key = storage.getItem("key");

    var myHeaders = new Headers();
    myHeaders.append("Authorization", "Basic " + btoa(user + ":" + key));

    var requestOptions = {
        method: "GET",
        headers: myHeaders,
        redirect: "follow"
    };
    var requestUrl = 'https://openbanking.atlassian.net/rest/api/latest/search?jql=project%3DOBSD%20AND%20type%20not%20in%20(TPP-ASPSP%2Cdowntime)%20AND%20assignee%3D"POB%20Queue"%20AND%20resolution%20is%20EMPTY%20ORDER%20BY%20created%20DESC&fields=key'

    fetch(requestUrl, requestOptions)
        .then(response => {
            if (!response.ok) {
                storage.setItem("jiraLastFailed?", true)
                throw new Error("API request failed - " + response.status);
            }
            storage.setItem("jiraLastFailed?", false)
            response.json().then(result => {
                newTicketsNotifier(result.total)
                logs("Jira Search Made - Ticket numbers: " + result.total)
            })
        })
        .catch(error => logs(error));

    if (active === "true") {
        setTimeout(function () {
            newTicketsSearch()
        }, 10000);
    }
};


// --------------- Initiate Request Loop --------------- //

function searchLoop(activated) {
    if (activated) {
        window.localStorage.setItem("activated", activated)
        newTicketsSearch()
    } else {
        window.localStorage.setItem("activated", activated)
    }
}

window.onload = function () {
    var storage = window.localStorage;

    var user = storage.getItem("user");
    var key = storage.getItem("key");

    logs("Extension has started.");
    if (key !== null && user !== null) {
        if (window.localStorage.getItem("activated") === "true") {
            chrome.contextMenus.update(
                "newqueuenotifier", {
                    checked: true
                }
            );
            searchLoop(true);
        }
    }
};
.


// --------------- Initiate Request Loop --------------- // 

chrome.runtime.onMessage.addListener(function (msg) {
    if (msg.recipient == "background") {

        if (msg.from == "options") {
            if (msg.toggleNotifier == true) {
                searchLoop(true);
                chrome.contextMenus.update(
                    "newqueuenotifier", {
                        checked: true
                    }
                );
            }
        }

        if (msg.from == "popup") {
            if (msg.toggleNotifier == true) {
                searchLoop(true);
                chrome.contextMenus.update(
                    "newqueuenotifier", {
                        checked: true
                    }
                );
            } else if (msg.toggleNotifier == false) {
                searchLoop(false);
                chrome.contextMenus.update(
                    "newqueuenotifier", {
                        checked: false
                    }
                );
                chrome.browserAction.setBadgeText({
                    text: ""
                });
            }
        }
    }
})