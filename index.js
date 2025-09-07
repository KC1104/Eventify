import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import session from "express-session";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: "supersecretkey",
    resave: false,
    saveUninitialized: false
}));

/*
const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    password: "K110406#VIR",
    database: "Event_Managment",
    port: 5432
});
*/
const db = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    host: "db.oepkrebighdavurrtakf.supabase.co"
});


db.connect()
  .then(() => console.log("✅ Connected to Supabase"))
  .catch(err => console.error("❌ Database connection error", err.stack));


app.get("/", async (req, res) => {
    const result = await db.query("Select * from events order by event_date asc");
    result.rows.forEach(event => {
        const dateObj = new Date(event.event_date);
        event.day = dateObj.getDate(); // 1–31
        event.month = dateObj.toLocaleString("default", { month: "short" }); // Jan, Feb, Oct
    });
    res.render("index.ejs", { events: result.rows });
})

app.get("/Login", (req, res) => {
    const msg = req.session.message || null;
    req.session.message = null;  // clear after passing
    res.render("login.ejs", { message: msg });
})

app.get("/student", async (req, res) => {
    if (!req.session.user) {
        res.redirect("/");
    } else {
        const studentID = req.session.user.id;
        const name = await db.query("Select name from users where id=$1", [studentID])

        const result = await db.query("SELECT e.event_id,e.title,e.description,e.event_date,e.organiser_id,u.name AS organiser_name FROM events e JOIN users u ON e.organiser_id = u.id order by event_date asc");
        result.rows.forEach(event => {
            const dateObj = new Date(event.event_date);
            event.day = dateObj.getDate(); // 1–31
            event.month = dateObj.toLocaleString("default", { month: "short" }); // Jan, Feb, Oct
        });

        const register = await db.query("select events.event_id,events.title,events.description,events.event_date,registrations.student_id from events inner join registrations on registrations.event_id = events.event_id where student_id = $1 order by event_date asc", [studentID])
        register.rows.forEach(event => {
            const dateObj = new Date(event.event_date);
            event.day = dateObj.getDate(); // 1–31
            event.month = dateObj.toLocaleString("default", { month: "short" }); // Jan, Feb, Oct
        });

        const msg = req.session.message || null;
        req.session.message = null;
        res.render("student.ejs", {
            events: result.rows,
            r_events: register.rows,
            username: name.rows[0].name,
            count: register.rows.length,
            message: msg
        });
    }
})

app.get("/organiser", async (req, res) => {
    if (!req.session.user) {
        res.redirect("/");
    } else {
        const organiserID = req.session.user.id;
        const name = await db.query("Select name from users where id=$1", [organiserID])

        const result = await db.query("SELECT e.event_id,e.title,e.description,e.event_date,e.organiser_id,u.name AS organiser_name FROM events e JOIN users u ON e.organiser_id = u.id order by event_date asc");
        result.rows.forEach(event => {
            const dateObj = new Date(event.event_date);
            event.day = dateObj.getDate(); // 1–31
            event.month = dateObj.toLocaleString("default", { month: "short" }); // Jan, Feb, Oct
        });

        const o_event = await db.query("SELECT e.event_id,e.title,e.description,e.event_date,e.organiser_id,u.name AS organiser_name FROM events e JOIN users u ON e.organiser_id = u.id where organiser_id=$1 order by event_date asc", [organiserID])
        o_event.rows.forEach(event => {
            const dateObj = new Date(event.event_date);
            event.day = dateObj.getDate(); // 1–31
            event.month = dateObj.toLocaleString("default", { month: "short" }); // Jan, Feb, Oct
        });

        const attendee = await db.query("SELECT COUNT(r.student_id) AS total_registrations FROM events e LEFT JOIN registrations r ON e.event_id = r.event_id WHERE e.organiser_id = $1", [organiserID]);

        const msg = req.session.message || null;
        req.session.message = null;

        res.render("organiser.ejs", {
            username: name.rows[0].name,
            events: result.rows,
            total: attendee.rows[0].total_registrations,
            o_events: o_event.rows,
            event_count: o_event.rows.length,
            message: msg
        })
    }
})

app.post("/user", async (req, res) => {
    const result = req.body;
    try {
        const insertResult = await db.query(
            "INSERT INTO users(name, role, password, mail) VALUES($1,$2,$3,$4) RETURNING id, role, name",
            [result.name, result.role, result.password, result.mail]
        );

        const user = insertResult.rows[0];
        req.session.user = {
            id: user.id,
            role: user.role,
            name: user.name
        };
        if (user.role == 'student') {
            req.session.message = { type: "success", text: "Account created successfully! Welcome, " + user.name };
            res.redirect("/student");
        } else {
            req.session.message = { type: "success", text: "Account created successfully! Welcome, " + user.name };
            res.redirect("/organiser");
        }
    } catch (err) {
        req.session.message = { type: "error", text: "User already exists. Please log in." };
        console.log("Error in inserting user")
        res.redirect("/Login");
    }

})

app.post("/login/user", async (req, res) => {
    const result = req.body;
    try {
        const insertResult = await db.query(
            "select * from users where mail=$1", [req.body.mail]);

        if (insertResult.rows.length != 0 && insertResult.rows[0].password == req.body.password) {
            const user = insertResult.rows[0];
            req.session.user = {
                id: user.id,
                role: user.role,
                name: user.name
            };
            if (user.role == 'student') {
                req.session.message = { type: "success", text: "Welcome back, " + user.name + "!" };
                res.redirect("/student");
            } else {
                req.session.message = { type: "success", text: "Welcome back, " + user.name + "!" };
                res.redirect("/organiser");
            }
        } else if (insertResult.rows.length == 0) {
            req.session.message = { type: "error", text: "User does not exist. Please sign up first." };
            res.redirect("/Login");
        } else {
            req.session.message = { type: "error", text: "Incorrect password. Please try again." };
            res.redirect("/Login");
        }


    } catch (err) {
        console.log(err)
        req.session.message = { type: "error", text: "Login failed. Wrong credentials." };
        console.log("Error in fetching user")
        res.redirect("/Login");
    }
})

app.post("/postEvent", async (req, res) => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');

    const formattedDate = `${yyyy}-${mm}-${dd}`;

    const result = req.body;
    try {
        await db.query("insert into events(title,description,event_date,organiser_id) values($1,$2,$3,$4)",
            [result.title, result.description, result.date, req.session.user.id]
        );
        req.session.message = { type: "success", text: "Event created successfully!" };
        res.redirect("/organiser")
    } catch (err) {
        req.session.message = { type: "error", text: "Error creating event. Please try again." };
        console.log("Error inserting data");
        res.redirect("/organiser");
    }
})

app.post("/registerEvent", async (req, res) => {
    const studentID = req.session.user.id;
    const e_id = req.body.event_id;
    try {
        await db.query("insert into registrations values($1,$2)", [studentID, e_id]);
        req.session.message = { type: "success", text: "Successfully registered for the event!" };
        res.redirect("/student")
    } catch (err) {
        req.session.message = { type: "error", text: "Failed to register for the event. Try again later." };
        console.log(err);
        console.log("error registering for the event")
        res.redirect("/student")
    }
})

app.post("/unregisterEvent", async (req, res) => {
    const studentID = req.session.user.id;
    const e_id = req.body.event_id;
    try {
        await db.query("delete from registrations where student_id=$1 and event_id=$2", [studentID, e_id])
        req.session.message = { type: "info", text: "You have unregistered from the event." };
        res.redirect("/student")
    } catch (err) {
        console.log(err);
        req.session.message = { type: "error", text: "Could not unregister from event. Try again." };
        console.log("Error in unregistering");
        res.redirect("/student")
    }
})

app.post("/updateEvent", async (req, res) => {
    const organiserIDd = req.session.user.id;
    const e_id = req.body.event_id;
    try {
        await db.query("update events set title=$1, description=$2, event_date=$3 where event_id=$4", [req.body.title, req.body.description, req.body.date, e_id]);
        req.session.message = { type: "success", text: "Event updated successfully!" };
        res.redirect("/organiser")
    } catch (err) {
        console.log(err)
        req.session.message = { type: "error", text: "Failed to update event. Please try again." };
        console.log("Error updating event ")
        res.redirect("/organiser")
    }
})

app.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log("Error destroying session:", err);
            if (req.session.user.role == "organiser") {
                return res.redirect("/organiser");
            } else {
                return res.redirect("/student")
            }
        };
        res.redirect("/Login")
    })
})
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})
