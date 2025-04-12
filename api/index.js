diff
--- a/api/index.js
+++ b/api/index.js
@@ -29,7 +29,9 @@
     if (req.session.sessionId) {
         return res.redirect("/session");
     }
-    res.render("index", { flash: req.session.flash });
+    const data = { }
+    if(req.session.flash) data.flash = req.session.flash;
+    res.render("index", data);
 });
 app.post("/", (req, res) => {
     console.log('Headers:', req.headers); console.log('Session data:', req.session);
@@ -68,7 +70,9 @@
         return res.redirect("/");
     }
     const net_profit = session.current_bankroll - session.starting_bankroll;
-    res.render("session", { ...session, net_profit, flash: req.session.flash });
+    const data = { ...session, net_profit};
+    if(req.session.flash) data.flash = req.session.flash;
+    res.render("session", data);
 });
 app.post("/session", (req, res) => {
     if (!req.session.sessionId) {