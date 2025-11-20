const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let users = []; // {id, name}
let deals = []; // {id, fromUserId, toUserId, offerText, requestText, status, createdAt, decidedAt}

function broadcastState() {
    io.emit("state", {
        users,
        deals
    });
}

app.post("/api/users", (req, res) => {
    const name = (req.body.name || "").trim();
    if (!name) {
        return res.status(400).json({ error: "name is required" });
    }

    const id = "u_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const user = { id, name };
    users.push(user);

    broadcastState();
    res.json(user);
});

app.get("/api/state", (req, res) => {
    res.json({ users, deals });
});

app.post("/api/deals", (req, res) => {
    const { fromUserId, toUserId, offerText, requestText } = req.body;

    if (!fromUserId || !toUserId || !offerText || !requestText) {
        return res.status(400).json({ error: "missing fields" });
    }

    const deal = {
        id: "d_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        fromUserId,
        toUserId,
        offerText: offerText.trim(),
        requestText: requestText.trim(),
        status: "PENDING",
        createdAt: Date.now(),
        decidedAt: null
    };

    deals.push(deal);
    broadcastState();

    res.json(deal);
});

app.post("/api/deals/:id/status", (req, res) => {
    const dealId = req.params.id;
    const { status } = req.body;

    if (!["ACCEPTED", "REJECTED"].includes(status)) {
        return res.status(400).json({ error: "invalid status" });
    }

    const deal = deals.find(d => d.id === dealId);
    if (!deal) {
        return res.status(404).json({ error: "deal not found" });
    }

    deal.status = status;
    deal.decidedAt = Date.now();

    broadcastState();
    res.json(deal);
});

io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.emit("state", { users, deals });

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("ITS A DEAL server listening on http://localhost:" + PORT);
});
