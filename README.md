# TA Dashboard

Two links from one website:

- `/mu/` shows Masters' Union (Central Functions, PG Programme, PG Programme (Bharat), UG Programme, Executive Education)
- `/tetr/` shows TETR (TETR Central Functions, TETR UG Programme, TETR PG Programme, TETR Executive Programme)

## How the data flows

```
TA data sheet  ->  Apps Script  ->  GitHub repository  ->  GitHub Action  ->  Firebase Hosting
 (your data)     (works out the    (saves public/data/    (builds and        (the two links,
                  numbers)          mu.json + tetr.json)   deploys)          free Spark plan)
```

1. The Apps Script in the sheet reads the Manpower and Candidate Data tabs and works out the numbers. It runs every hour, or when someone clicks **TA Dashboard > Publish now** in the sheet.
2. It saves two small files, `public/data/mu.json` and `public/data/tetr.json`, in your GitHub repository. **If the numbers haven't changed it saves nothing**, so quiet hours cause no new website builds.
3. Every save to the repository starts the GitHub Action in `.github/workflows/deploy.yml`, which builds the site and publishes it on Firebase Hosting. This takes about 2 to 3 minutes.
4. The website reads its numbers from those files. It never contacts the sheet or Google.

The **Refresh data** button on each page reloads the latest *published* numbers. It tells you when nothing new has been published. To send fresh numbers from the sheet right away, use **TA Dashboard > Publish now** in the sheet, wait 2 to 3 minutes, then click Refresh data.

## Rules built in

- A Business Unit belongs to a payroll unit only if its **full name** matches exactly (spaces and capitals ignored). `PG Programme (PGP)` is MU, `TETR PG Programme (TETR_PG)` is TETR. The list is at the top of `apps-script/Code.gs`.
- `JOB_10` is dropped everywhere. Only that exact ID is dropped, so `JOB_100` is not affected.
- Rows with a blank or unrecognised Business Unit are ignored.
- Only counts are published. Candidate names, emails and phone numbers are never read.
- Recruiter names are shown without their employee ID. Referral candidates are grouped as "Employee referral", so individual referrers are not listed.
- Role Name comes from the `Job Name` column in Candidate Data, matched on Job ID. A job with no candidates yet shows a dash.
- If a Business Unit is renamed in the sheet, update the list at the top of `Code.gs` and paste the new `Code.gs` into the sheet's script.

---

## Setup (about 30 minutes, once)

### Step 1. Put the script in the sheet

1. Open the "TA data" sheet. Click **Extensions > Apps Script**.
2. Delete the sample code. Open `apps-script/Code.gs` from this folder **in Notepad** (right-click, Open with > Notepad), press Ctrl+A then Ctrl+C, and paste it into the editor.
3. Click the save icon. Name the project `TA Dashboard`.
4. In the function dropdown at the top choose **dryRun** and click **Run**. Approve Google's permission prompts: **Review permissions**, choose your account, **Advanced**, **Go to TA Dashboard (unsafe)**, **Allow**. It says "unsafe" only because you wrote it and Google hasn't reviewed it.
5. The **Execution log** at the bottom should show two lines such as `MU: 28 jobs, 0 data checks` and `TETR: 38 jobs, 1 data checks`. Compare the job counts with your sheet.

If you used the earlier web-app version, remove it so nothing stays open to the public: **Deploy > Manage deployments**, then archive the old web app deployment.

### Step 2. Create a private GitHub repository

1. Sign in at github.com. Click **+ > New repository**.
2. Name it `ta-dashboard`. Choose **Private**. Leave the "add a README / .gitignore / license" boxes unticked. Click **Create repository**.
3. Note the repository's full name, `owner/ta-dashboard`. The owner is your GitHub username, or your organisation's name. You'll need it in step 4.

Keep it private. The repository holds the published numbers and their history.

### Step 3. Create a token that lets the script save files

1. On GitHub click your profile picture, then **Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate new token**.
2. Name: `ta-dashboard-publisher`. **Expiration**: choose the longest your organisation allows, and put a reminder in your calendar a week before it ends (see "Things to know").
3. **Resource owner**: the same owner as the repository.
4. **Repository access**: choose **Only select repositories** and pick `ta-dashboard`.
5. Under **Permissions > Repository permissions**, set **Contents** to **Read and write**. Leave everything else as it is.
6. Click **Generate token** and copy the token now. GitHub shows it only once. Don't paste it into chat, email or the code.

If your GitHub organisation requires approval for tokens, an organisation owner has to approve it.

### Step 4. Give the script its settings

1. In the Apps Script editor click the gear icon (**Project Settings**) on the left.
2. Scroll to **Script properties** and click **Add script property** three times:

| Property | Value |
|---|---|
| `GITHUB_TOKEN` | the token from step 3 |
| `GITHUB_REPO` | `owner/ta-dashboard` (for example `mastersunion/ta-dashboard`) |
| `GITHUB_BRANCH` | `main` |

3. Click **Save script properties**.

The token lives only in the script's private settings. Anyone with edit access to the sheet's script can see it, so share edit access carefully.

### Step 5. Connect Firebase to GitHub

This lets GitHub publish to your Firebase project. It needs the Firebase tools you installed earlier.

1. Open PowerShell in this project folder (open the folder in File Explorer, click the address bar, type `powershell`, press Enter).
2. Run:
   ```
   firebase init hosting:github
   ```
3. It opens a browser window to sign in to GitHub: allow it. Then answer the questions:
   - Repository: type `owner/ta-dashboard`.
   - "Set up the workflow to run a build script before every deploy?": **No** (our workflow already builds).
   - "Set up automatic deployment to your site's live channel when a PR is merged?": **No**.
4. It stores a secret in your repository so GitHub is allowed to deploy to Firebase. It may also create a file `.github/workflows/firebase-hosting-pull-request.yml` in this folder. **Delete that file** if it appears. Only `deploy.yml` is needed.
5. Check the secret's name: on GitHub open your repository, **Settings > Secrets and variables > Actions**. You should see a secret called `FIREBASE_SERVICE_ACCOUNT_TA_DASHBOARD_CB04D`. That is the name `deploy.yml` uses. If yours is named differently, change that one name in `.github/workflows/deploy.yml`, in the line starting `firebaseServiceAccount:`.

### Step 6. Upload the project to GitHub

1. Open your repository on GitHub. Click **uploading an existing file** (or **Add file > Upload files**).
2. Open this project folder in File Explorer. Select **everything inside it except** the folders `node_modules`, `out` and `.next` (they don't exist unless you built the site on your computer). Drag the selection into the browser.
3. Make sure `.github`, `app`, `apps-script`, `components`, `lib`, `public`, `scripts` and the loose files (`package.json`, `package-lock.json`, `firebase.json` and so on) all appear in the upload list. Click **Commit changes**.
4. If `.github` doesn't upload, click **Add file > Create new file**, type `.github/workflows/deploy.yml` as the name (typing `/` makes the folders), paste the contents of `deploy.yml`, and commit.

This first upload starts the GitHub Action. Open the **Actions** tab to watch it. A green tick means the website is live. At this point the pages will say "No data has been published yet." That is expected.

### Step 7. Publish the first numbers

1. Go back to the "TA data" sheet and reload the page. A new menu **TA Dashboard** appears next to Help.
2. Click **TA Dashboard > Publish now**. Approve the permission prompt if Google asks (it now also needs to contact GitHub).
3. A message says the numbers were sent. In GitHub's **Actions** tab a new run starts, and about 2 to 3 minutes later your links work:
   - `https://ta-dashboard-cb04d.web.app/mu/`
   - `https://ta-dashboard-cb04d.web.app/tetr/`
4. Compare one Business Unit's numbers with your sheet.

### Step 8. Turn on hourly publishing

In the sheet click **TA Dashboard > Turn on automatic publishing (hourly)**. To get an email if a run fails, open the clock icon (**Triggers**) in the Apps Script editor, click the three dots beside the trigger, choose **Edit**, and under **Failure notification settings** pick **Notify me immediately**.

---

## Things to know

- **The links are open.** Anyone with the address can see the numbers, and the two data files are reachable at `/data/mu.json` and `/data/tetr.json`. Someone can also change `/mu/` to `/tetr/` in the address.
- **The token expires.** When it does, publishing fails and the website keeps showing the last published numbers. Create a new token (step 3) and replace `GITHUB_TOKEN` (step 4).
- **It runs as you.** The hourly publish uses the permissions of the person who switched it on. If that person leaves or loses access to the sheet, switch it on again from another account.
- **GitHub's free allowance.** Private repositories on GitHub's free plan include a monthly allowance of build minutes (check your plan's current figure under Settings > Billing). Each publish that changes numbers uses a minute or two. Hourly publishing during working hours is normally fine. If you run short, change `PUBLISH_EVERY_HOURS` at the top of `Code.gs` to 2 or 3, paste the updated script into the sheet, and switch automatic publishing on again.
- **Changing the script later.** Paste the new `Code.gs` into the sheet's script and save. There is nothing to deploy.
- **Changing the website later.** Upload the changed files to the repository (Add file > Upload files). GitHub rebuilds and publishes by itself.

## Checking the code

`npm run check` runs `apps-script/Code.gs` against generated sample data and a pretend GitHub. It tests the unit split, the JOB_10 exclusion, that no personal details come out, that unchanged numbers cause no save, the retry when GitHub reports a conflict, the plain-language errors, and that the token never appears in a log or message.
