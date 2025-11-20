let socket = null;
let currentUserId = null;
let users = [];
let deals = [];

const USER_ID_KEY = "its_a_deal_user_id";

window.addEventListener("load", () => {
    const registerOverlay = document.getElementById("registerOverlay");
    const registerNameInput = document.getElementById("registerName");
    const registerBtn = document.getElementById("registerBtn");
    const registerError = document.getElementById("registerError");

    const currentUserSelect = document.getElementById("currentUserSelect");
    const currentUserInfo = document.getElementById("currentUserInfo");
    const dealTargetSelect = document.getElementById("dealTargetSelect");
    const sendDealBtn = document.getElementById("sendDealBtn");
    const createDealMessage = document.getElementById("createDealMessage");

    const savedId = localStorage.getItem(USER_ID_KEY);
    if (!savedId) {
        registerOverlay.style.display = "flex";
    } else {
        currentUserId = savedId;
        registerOverlay.style.display = "none";
        initSocketAndState();
    }

    registerBtn.addEventListener("click", async () => {
        registerError.textContent = "";
        const name = (registerNameInput.value || "").trim();
        if (!name) {
            registerError.textContent = "צריך לכתוב שם";
            return;
        }

        try {
            const res = await fetch("/api/users", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ name })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                registerError.textContent = data.error || "שגיאה ביצירת משתמש";
                return;
            }
            const user = await res.json();
            currentUserId = user.id;
            localStorage.setItem(USER_ID_KEY, currentUserId);
            registerOverlay.style.display = "none";
            initSocketAndState();
        } catch (e) {
            console.error(e);
            registerError.textContent = "שגיאת רשת";
        }
    });

    currentUserSelect.addEventListener("change", () => {
        currentUserId = currentUserSelect.value;
        localStorage.setItem(USER_ID_KEY, currentUserId);
        updateCurrentUserInfo();
        renderInbox();
        renderScoreboard();
    });

    sendDealBtn.addEventListener("click", async () => {
        createDealMessage.textContent = "";
        createDealMessage.className = "status-message";

        const targetId = dealTargetSelect.value;
        const offerText = document.getElementById("offerText").value.trim();
        const requestText = document.getElementById("requestText").value.trim();

        if (!currentUserId) {
            createDealMessage.textContent = "צריך לבחור משתמש קודם";
            createDealMessage.classList.add("error");
            return;
        }
        if (!targetId) {
            createDealMessage.textContent = "בחר למי אתה שולח דיל";
            createDealMessage.classList.add("error");
            return;
        }
        if (targetId === currentUserId) {
            createDealMessage.textContent = "אי אפשר לשלוח דיל לעצמך 😉";
            createDealMessage.classList.add("error");
            return;
        }
        if (!offerText || !requestText) {
            createDealMessage.textContent = "מלא גם מה אתה מציע וגם מה אתה מבקש";
            createDealMessage.classList.add("error");
            return;
        }

        try {
            const res = await fetch("/api/deals", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    fromUserId: currentUserId,
                    toUserId: targetId,
                    offerText,
                    requestText
                })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                createDealMessage.textContent = data.error || "שגיאה בשליחת הדיל";
                createDealMessage.classList.add("error");
                return;
            }
            document.getElementById("offerText").value = "";
            document.getElementById("requestText").value = "";
            createDealMessage.textContent = "הדיל נשלח ✅";
            createDealMessage.classList.add("ok");
        } catch (e) {
            console.error(e);
            createDealMessage.textContent = "שגיאת רשת";
            createDealMessage.classList.add("error");
        }
    });

    async function initSocketAndState() {
        try {
            const res = await fetch("/api/state");
            const data = await res.json();
            users = data.users || [];
            deals = data.deals || [];
            updateUsersUI();
            updateCurrentUserInfo();
            renderInbox();
            renderScoreboard();
        } catch (e) {
            console.error("Error fetching state:", e);
        }

        socket = io();

        socket.on("state", (data) => {
            users = data.users || [];
            deals = data.deals || [];
            updateUsersUI();
            renderInbox();
            renderScoreboard();
        });
    }

    function updateUsersUI() {
        const currentUserSelect = document.getElementById("currentUserSelect");
        const dealTargetSelect = document.getElementById("dealTargetSelect");
        currentUserSelect.innerHTML = "";
        dealTargetSelect.innerHTML = "";

        users.forEach(u => {
            const opt1 = document.createElement("option");
            opt1.value = u.id;
            opt1.textContent = u.name;
            currentUserSelect.appendChild(opt1);

            const opt2 = document.createElement("option");
            opt2.value = u.id;
            opt2.textContent = u.name;
            dealTargetSelect.appendChild(opt2);
        });

        if (!users.find(u => u.id === currentUserId) && users.length > 0) {
            currentUserId = users[0].id;
            localStorage.setItem(USER_ID_KEY, currentUserId);
        }

        if (currentUserId) {
            currentUserSelect.value = currentUserId;
        }
    }

    function updateCurrentUserInfo() {
        const currentUserInfo = document.getElementById("currentUserInfo");
        const name = getUserNameById(currentUserId);
        currentUserInfo.textContent = name ? ("אתה מחובר בתור: " + name) : "";
    }

    function getUserNameById(id) {
        const u = users.find(u => u.id === id);
        return u ? u.name : "";
    }

    function renderInbox() {
        const inboxContainer = document.getElementById("inboxContainer");
        inboxContainer.innerHTML = "";

        if (!currentUserId) return;

        const myDeals = deals.filter(d => d.toUserId === currentUserId && d.status === "PENDING");

        if (myDeals.length === 0) {
            const p = document.createElement("p");
            p.textContent = "אין דילים ממתינים כרגע 🙌";
            p.style.fontSize = "13px";
            p.style.opacity = "0.8";
            inboxContainer.appendChild(p);
            return;
        }

        myDeals.sort((a, b) => b.createdAt - a.createdAt);

        myDeals.forEach(deal => {
            const item = document.createElement("div");
            item.className = "deal-item";

            const header = document.createElement("div");
            header.className = "deal-header";
            header.innerHTML = `<strong>${getUserNameById(deal.fromUserId)}</strong> הציע לך דיל`;

            const body = document.createElement("div");
            body.className = "deal-body";

            const pOffer = document.createElement("p");
            pOffer.innerHTML = `<strong>מה הוא מציע:</strong> ${deal.offerText}`;

            const pReq = document.createElement("p");
            pReq.innerHTML = `<strong>מה הוא מבקש בתמורה:</strong> ${deal.requestText}`;

            body.appendChild(pOffer);
            body.appendChild(pReq);

            const actions = document.createElement("div");
            actions.className = "deal-actions";

            const btnAccept = document.createElement("button");
            btnAccept.className = "btn small accept";
            btnAccept.textContent = "קבל ✅";
            btnAccept.addEventListener("click", () => {
                updateDealStatus(deal.id, "ACCEPTED");
            });

            const btnReject = document.createElement("button");
            btnReject.className = "btn small reject";
            btnReject.textContent = "דחה ❌";
            btnReject.addEventListener("click", () => {
                updateDealStatus(deal.id, "REJECTED");
            });

            actions.appendChild(btnAccept);
            actions.appendChild(btnReject);

            item.appendChild(header);
            item.appendChild(body);
            item.appendChild(actions);

            inboxContainer.appendChild(item);
        });
    }

    async function updateDealStatus(dealId, status) {
        try {
            const res = await fetch(`/api/deals/${dealId}/status`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ status })
            });
            if (!res.ok) {
                console.error("status change failed");
                return;
            }
        } catch (e) {
            console.error(e);
        }
    }

    function renderScoreboard() {
        const tbody = document.getElementById("scoreTableBody");
        tbody.innerHTML = "";

        const counts = {};
        users.forEach(u => {
            counts[u.id] = {
                name: u.name,
                owedTo: 0,
                owes: 0
            };
        });

        deals
            .filter(d => d.status === "ACCEPTED")
            .forEach(d => {
                if (counts[d.fromUserId]) {
                    counts[d.fromUserId].owedTo += 1;
                }
                if (counts[d.toUserId]) {
                    counts[d.toUserId].owes += 1;
                }
            });

        const arr = Object.keys(counts).map(id => {
            const c = counts[id];
            return {
                id,
                name: c.name,
                owedTo: c.owedTo,
                owes: c.owes,
                net: c.owedTo - c.owes
            };
        });

        arr.sort((a, b) => {
            if (b.owedTo !== a.owedTo) return b.owedTo - a.owedTo;
            return b.net - a.net;
        });

        arr.forEach(row => {
            const tr = document.createElement("tr");

            const tdName = document.createElement("td");
            tdName.textContent = row.name;

            const tdOwedTo = document.createElement("td");
            tdOwedTo.textContent = row.owedTo;

            const tdOwes = document.createElement("td");
            tdOwes.textContent = row.owes;

            const tdNet = document.createElement("td");
            tdNet.textContent = row.net;
            if (row.net > 0) tdNet.classList.add("score-positive");
            if (row.net < 0) tdNet.classList.add("score-negative");

            tr.appendChild(tdName);
            tr.appendChild(tdOwedTo);
            tr.appendChild(tdOwes);
            tr.appendChild(tdNet);

            tbody.appendChild(tr);
        });
    }
});
