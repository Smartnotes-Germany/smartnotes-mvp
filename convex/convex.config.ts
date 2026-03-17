import { defineApp } from "convex/server";
import convexFilesControl from "@gilhrpenner/convex-files-control/convex.config";
import migrations from "@convex-dev/migrations/convex.config";

const app = defineApp();

app.use(convexFilesControl);
app.use(migrations);

export default app;
