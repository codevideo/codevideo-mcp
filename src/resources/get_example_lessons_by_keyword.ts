import { ILesson } from "@fullstackcraftllc/codevideo-types";

const keywordsToExampleLessonsMap: Array<{ keywords: string[], lesson: ILesson }> = [
    {
        keywords: ["go", "golang", "explore codebase", "existing codebase", "go cli tool"],
        lesson: {
            "id": "",
            "name": "",
            "description": "",
            "actions": [
                {
                    "name": "author-speak-before",
                    "value": "Hi there! Let's explore this interesting Golang repository that helps track GitLab contributions. This tool analyzes user activity across different time periods and produces contribution statistics."
                },
                {
                    "name": "mouse-move-file-explorer",
                    "value": "1"
                },
                {
                    "name": "mouse-move-file-explorer-file",
                    "value": "main.go"
                },
                {
                    "name": "mouse-left-click",
                    "value": "1"
                },
                {
                    "name": "author-speak-before",
                    "value": "The main.go file is the entry point for the application. It defines the core functionality for tracking GitLab contributions."
                },
                {
                    "name": "mouse-move-to-coordinates-percent",
                    "value": "50,20"
                },
                {
                    "name": "author-speak-before",
                    "value": "This struct stores contribution statistics for a user - tracking both commits and merge requests across different time periods."
                },
                {
                    "name": "author-speak-before",
                    "value": "The main function initializes the application by loading environment variables, getting the GitLab token, and reading usernames from a file."
                },
                {
                    "name": "mouse-move-file-explorer-file",
                    "value": "usernames.txt"
                },
                {
                    "name": "mouse-left-click",
                    "value": "1"
                },
                {
                    "name": "author-speak-before",
                    "value": "The usernames.txt file contains the list of GitLab users whose contributions we want to track."
                },
                {
                    "name": "mouse-move-file-explorer-file",
                    "value": "main.go"
                },
                {
                    "name": "mouse-left-click",
                    "value": "1"
                },
                {
                    "name": "file-explorer-open-file",
                    "value": "main.go"
                },
                {
                    "name": "author-speak-before",
                    "value": "This function calculates contribution statistics for a single user. It defines time windows for different periods - daily, weekly, monthly, and yearly."
                },
                {
                    "name": "author-speak-before",
                    "value": "The GetUserActivity function connects to the GitLab API to fetch user events within a specified time period."
                },
                {
                    "name": "author-speak-before",
                    "value": "The printResults function formats and displays the contribution statistics, including calculating metrics like average commits per merge request."
                },
                {
                    "name": "mouse-move-file-explorer",
                    "value": "1"
                },
                {
                    "name": "mouse-move-file-explorer-folder",
                    "value": "http_helper"
                },
                {
                    "name": "mouse-left-click",
                    "value": "1"
                },
                {
                    "name": "file-explorer-expand-folder",
                    "value": "http_helper"
                },
                {
                    "name": "mouse-move-file-explorer-file",
                    "value": "http_helper/http_helper.go"
                },
                {
                    "name": "mouse-left-click",
                    "value": "1"
                },
                {
                    "name": "file-explorer-open-file",
                    "value": "http_helper/http_helper.go"
                },
                {
                    "name": "author-speak-before",
                    "value": "The project has a dedicated HTTP helper module that handles API requests to GitLab."
                },
                {
                    "name": "editor-highlight-code",
                    "value": "func MakeHTTPRequest(fullUrl string, httpMethod string, headers map[string]string, queryParameters url.Values, body io.Reader) ([]byte, error) {"
                },
                {
                    "name": "author-speak-before",
                    "value": "This function handles standard HTTP requests, while the function below uses generics for typed responses."
                },
                {
                    "name": "editor-highlight-code",
                    "value": "func MakeHTTPRequestGeneric[T any](fullUrl string, httpMethod string, headers map[string]string, queryParameters url.Values, body io.Reader, responseType T) (T, error) {"
                },
                {
                    "name": "author-speak-before",
                    "value": "MakeHTTPRequestGeneric is a modern Go function using generics to handle typed API responses, making it easier to work with the GitLab API."
                },
                {
                    "name": "mouse-move-file-explorer-file",
                    "value": "main_test.go"
                },
                {
                    "name": "mouse-left-click",
                    "value": "1"
                },
                {
                    "name": "file-explorer-open-file",
                    "value": "main_test.go"
                },
                {
                    "name": "author-speak-before",
                    "value": "The project also includes tests to verify the functionality of the GitLab API interactions."
                },
                {
                    "name": "mouse-move-file-explorer-file",
                    "value": ".env"
                },
                {
                    "name": "mouse-left-click",
                    "value": "1"
                },
                {
                    "name": "file-explorer-open-file",
                    "value": ".env"
                },
                {
                    "name": "author-speak-before",
                    "value": "The .env file stores the GitLab token needed to authenticate with the API."
                },
                {
                    "name": "mouse-move-file-explorer-file",
                    "value": "go.mod"
                },
                {
                    "name": "mouse-left-click",
                    "value": "1"
                },
                {
                    "name": "file-explorer-open-file",
                    "value": "go.mod"
                },
                {
                    "name": "author-speak-before",
                    "value": "The go.mod file lists the project dependencies, including the go-gitlab library for API interaction and godotenv for environment variable loading."
                },
                {
                    "name": "mouse-move-file-explorer-file",
                    "value": "main.go"
                },
                {
                    "name": "mouse-left-click",
                    "value": "1"
                },
                {
                    "name": "file-explorer-open-file",
                    "value": "main.go"
                },
                {
                    "name": "author-speak-after",
                    "value": "To summarize, this Go repository is a GitLab contribution analyzer that fetches user activity data from GitLab's API. It tracks commits and merge requests across multiple time periods, calculates stats, and outputs nicely formatted results with progress bars. It's designed to help track team productivity and identify top contributors. The code is well-structured with separate modules for HTTP requests and includes proper error handling and testing."
                }
            ],
            "initialSnapshot": {
                "isUnsavedChangesDialogOpen": false,
                "unsavedFileName": "",
                "fileExplorerSnapshot": {
                    "isFileExplorerContextMenuOpen": false,
                    "isFileContextMenuOpen": false,
                    "isFolderContextMenuOpen": false,
                    "isNewFileInputVisible": false,
                    "isNewFolderInputVisible": false,
                    "isRenameFileInputVisible": false,
                    "isRenameFolderInputVisible": false,
                    "newFileInputValue": "",
                    "newFolderInputValue": "",
                    "renameFileInputValue": "",
                    "renameFolderInputValue": "",
                    "originalFileBeingRenamed": "",
                    "originalFolderBeingRenamed": "",
                    "newFileParentPath": "",
                    "newFolderParentPath": "",
                    "fileStructure": {
                        ".env": {
                            "type": "file",
                            "content": "GITLAB_TOKEN=glpat-uShSYUHwpUcDxfkGcoNL",
                            "language": "plaintext",
                            "caretPosition": {
                                "row": 0,
                                "col": 0
                            }
                        },
                        ".gitignore": {
                            "type": "file",
                            "content": ".env",
                            "language": "plaintext",
                            "caretPosition": {
                                "row": 0,
                                "col": 0
                            }
                        },
                        "go.mod": {
                            "type": "file",
                            "content": "module solve.ch/solvers\n\ngo 1.23.0\n\nrequire github.com/xanzy/go-gitlab v0.115.0\n\nrequire (\n\tgithub.com/golang/protobuf v1.5.3 // indirect\n\tgithub.com/google/go-querystring v1.1.0 // indirect\n\tgithub.com/hashicorp/go-cleanhttp v0.5.2 // indirect\n\tgithub.com/hashicorp/go-retryablehttp v0.7.7 // indirect\n\tgithub.com/joho/godotenv v1.5.1\n\tgitlab.com/gitlab-org/api/client-go v0.120.0\n\tgolang.org/x/net v0.8.0 // indirect\n\tgolang.org/x/oauth2 v0.24.0 // indirect\n\tgolang.org/x/time v0.8.0 // indirect\n\tgoogle.golang.org/appengine v1.6.7 // indirect\n\tgoogle.golang.org/protobuf v1.29.1 // indirect\n)\n",
                            "language": "plaintext",
                            "caretPosition": {
                                "row": 0,
                                "col": 0
                            }
                        },
                        "go.sum": {
                            "type": "file",
                            "content": "github.com/golang/protobuf v1.3.1/go.mod h1:6lQm79b+lXiMfvg/cZm0SGofjICqVBUtrP5yJMmIC1U=\ngithub.com/golang/protobuf v1.5.0/go.mod h1:FsONVRAS9T7sI+LIUmWTfcYkHO4aIWwzhcaSAoJOfIk=\ngithub.com/golang/protobuf v1.5.3 h1:KhyjKVUg7Usr/dYsdSqoFveMYd5ko72D+zANwlG1mmg=\ngithub.com/golang/protobuf v1.5.3/go.mod h1:XVQd3VNwM+JqD3oG2Ue2ip4fOMUkwXdXDdiuN0vRsmY=\ngithub.com/google/go-cmp v0.5.2/go.mod h1:v8dTdLbMG2kIc/vJvl+f65V22dbkXbowE6jgT/gNBxE=\ngithub.com/google/go-cmp v0.5.5/go.mod h1:v8dTdLbMG2kIc/vJvl+f65V22dbkXbowE6jgT/gNBxE=\ngithub.com/google/go-querystring v1.1.0 h1:AnCroh3fv4ZBgVIf1Iwtovgjaw/GiKJo8M8yD/fhyJ8=\ngithub.com/google/go-querystring v1.1.0/go.mod h1:Kcdr2DB4koayq7X8pmAG4sNG59So17icRSOU623lUBU=\ngithub.com/hashicorp/go-cleanhttp v0.5.2 h1:035FKYIWjmULyFRBKPs8TBQoi0x6d9G4xc9neXJWAZQ=\ngithub.com/hashicorp/go-cleanhttp v0.5.2/go.mod h1:kO/YDlP8L1346E6Sodw+PrpBSV4/SoxCXGY6BqNFT48=\ngithub.com/hashicorp/go-retryablehttp v0.7.7 h1:C8hUCYzor8PIfXHa4UrZkU4VvK8o9ISHxT2Q8+VepXU=\ngithub.com/hashicorp/go-retryablehttp v0.7.7/go.mod h1:pkQpWZeYWskR+D1tR2O5OcBFOxfA7DoAO6xtkuQnHTk=\ngithub.com/joho/godotenv v1.5.1 h1:7eLL/+HRGLY0ldzfGMeQkb7vMd0as4CfYvUVzLqw0N0=\ngithub.com/joho/godotenv v1.5.1/go.mod h1:f4LDr5Voq0i2e/R5DDNOoa2zzDfwtkZa6DnEwAbqwq4=\ngithub.com/xanzy/go-gitlab v0.115.0 h1:6DmtItNcVe+At/liXSgfE/DZNZrGfalQmBRmOcJjOn8=\ngithub.com/xanzy/go-gitlab v0.115.0/go.mod h1:5XCDtM7AM6WMKmfDdOiEpyRWUqui2iS9ILfvCZ2gJ5M=\ngitlab.com/gitlab-org/api/client-go v0.120.0 h1:geCJjojDXxWVmUcTxPcOUCenAWElWB5dVfX3HJGeAMc=\ngitlab.com/gitlab-org/api/client-go v0.120.0/go.mod h1:ygHmS3AU3TpvK+AC6DYO1QuAxLlv6yxYK+/Votr/WFQ=\ngolang.org/x/crypto v0.0.0-20190308221718-c2843e01d9a2/go.mod h1:djNgcEr1/C05ACkg1iLfiJU5Ep61QUkGW8qpdssI0+w=\ngolang.org/x/net v0.0.0-20190603091049-60506f45cf65/go.mod h1:HSz+uSET+XFnRR8LxR5pz3Of3rY3CfYBVs4xY44aLks=\ngolang.org/x/net v0.8.0 h1:Zrh2ngAOFYneWTAIAPethzeaQLuHwhuBkuV6ZiRnUaQ=\ngolang.org/x/net v0.8.0/go.mod h1:QVkue5JL9kW//ek3r6jTKnTFis1tRmNAW2P1shuFdJc=\ngolang.org/x/oauth2 v0.6.0 h1:Lh8GPgSKBfWSwFvtuWOfeI3aAAnbXTSutYxJiOJFgIw=\ngolang.org/x/oauth2 v0.6.0/go.mod h1:ycmewcwgD4Rpr3eZJLSB4Kyyljb3qDh40vJ8STE5HKw=\ngolang.org/x/oauth2 v0.24.0 h1:KTBBxWqUa0ykRPLtV69rRto9TLXcqYkeswu48x/gvNE=\ngolang.org/x/oauth2 v0.24.0/go.mod h1:XYTD2NtWslqkgxebSiOHnXEap4TF09sJSc7H1sXbhtI=\ngolang.org/x/sys v0.0.0-20190215142949-d0b11bdaac8a/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=\ngolang.org/x/text v0.3.0/go.mod h1:NqM8EUOU14njkJ3fqMW+pc6Ldnwhi/IjpwHt7yyuwOQ=\ngolang.org/x/text v0.3.2/go.mod h1:bEr9sfX3Q8Zfm5fL9x+3itogRgK3+ptLWKqgva+5dAk=\ngolang.org/x/time v0.3.0 h1:rg5rLMjNzMS1RkNLzCG38eapWhnYLFYXDXj2gOlr8j4=\ngolang.org/x/time v0.3.0/go.mod h1:tRJNPiyCQ0inRvYxbN9jk5I+vvW/OXSQhTDSoE431IQ=\ngolang.org/x/time v0.8.0 h1:9i3RxcPv3PZnitoVGMPDKZSq1xW1gK1Xy3ArNOGZfEg=\ngolang.org/x/time v0.8.0/go.mod h1:3BpzKBy/shNhVucY/MWOyx10tF3SFh9QdLuxbVysPQM=\ngolang.org/x/tools v0.0.0-20180917221912-90fa682c2a6e/go.mod h1:n7NCudcB/nEzxVGmLbDWY5pfWTLqBcC2KZ6jyYvM4mQ=\ngolang.org/x/xerrors v0.0.0-20191204190536-9bdfabe68543/go.mod h1:I/5z698sn9Ka8TeJc9MKroUUfqBBauWjQqLJ2OPfmY0=\ngoogle.golang.org/appengine v1.6.7 h1:FZR1q0exgwxzPzp/aF+VccGrSfxfPpkBqjIIEq3ru6c=\ngoogle.golang.org/appengine v1.6.7/go.mod h1:8WjMMxjGQR8xUklV/ARdw2HLXBOI7O7uCIDZVag1xfc=\ngoogle.golang.org/protobuf v1.26.0-rc.1/go.mod h1:jlhhOSvTdKEhbULTjvd4ARK9grFBp09yW+WbY/TyQbw=\ngoogle.golang.org/protobuf v1.26.0/go.mod h1:9q0QmTI4eRPtz6boOQmLYwt+qCgq0jsYwAQnmE0givc=\ngoogle.golang.org/protobuf v1.29.1 h1:7QBf+IK2gx70Ap/hDsOmam3GE0v9HicjfEdAxE62UoM=\ngoogle.golang.org/protobuf v1.29.1/go.mod h1:HV8QOd/L58Z+nl8r43ehVNZIU/HEI6OcFqwMG9pJV4I=\n",
                            "language": "plaintext",
                            "caretPosition": {
                                "row": 0,
                                "col": 0
                            }
                        },
                        "http_helper": {
                            "type": "directory",
                            "content": "",
                            "collapsed": false,
                            "children": {
                                "http_helper.go": {
                                    "type": "file",
                                    "content": "package http_helper\n\nimport (\n\t\"encoding/json\"\n\t\"fmt\"\n\t\"io\"\n\t\"log\"\n\t\"net/http\"\n\t\"net/url\"\n\t\"strings\"\n)\n\n// in the case of GET, the parameter queryParameters is transferred to the URL as query parameters\n// in the case of POST, the parameter body, an io.Reader, is used\nfunc MakeHTTPRequest(fullUrl string, httpMethod string, headers map[string]string, queryParameters url.Values, body io.Reader) ([]byte, error) {\n\tclient := http.Client{}\n\tu, err := url.Parse(fullUrl)\n\tif err != nil {\n\t\treturn nil, err\n\t}\n\n\t// if it's a GET, we need to append the query parameters.\n\tif httpMethod == \"GET\" {\n\t\tq := u.Query()\n\n\t\tfor k, v := range queryParameters {\n\t\t\t// this depends on the type of api, you may need to do it for each of v\n\t\t\tq.Set(k, strings.Join(v, \",\"))\n\t\t}\n\t\t// set the query to the encoded parameters\n\t\tu.RawQuery = q.Encode()\n\t}\n\n\t// regardless of GET or POST, we can safely add the body\n\treq, err := http.NewRequest(httpMethod, u.String(), body)\n\tif err != nil {\n\t\treturn nil, err\n\t}\n\n\t// for each header passed, add the header value to the request\n\tfor k, v := range headers {\n\t\treq.Header.Set(k, v)\n\t}\n\n\t// optional: log the request for easier stack tracing\n\tlog.Printf(\"%s %s\\n\", httpMethod, req.URL.String())\n\n\t// finally, do the request\n\tres, err := client.Do(req)\n\tif err != nil {\n\t\treturn nil, err\n\t}\n\n\tif res == nil {\n\t\treturn nil, fmt.Errorf(\"error: calling %s returned empty response\", u.String())\n\t}\n\n\tresponseData, err := io.ReadAll(res.Body)\n\tif err != nil {\n\t\treturn nil, err\n\t}\n\n\tdefer res.Body.Close()\n\n\tif res.StatusCode != http.StatusOK {\n\t\treturn nil, fmt.Errorf(\"error calling %s:\\nstatus: %s\\nresponseData: %s\", u.String(), res.Status, responseData)\n\t}\n\n\treturn responseData, nil\n}\n\nfunc MakeHTTPRequestGeneric[T any](fullUrl string, httpMethod string, headers map[string]string, queryParameters url.Values, body io.Reader, responseType T) (T, error) {\n\tclient := http.Client{}\n\tu, err := url.Parse(fullUrl)\n\tif err != nil {\n\t\treturn responseType, err\n\t}\n\n\t// if it's a GET, we need to append the query parameters.\n\tif httpMethod == \"GET\" {\n\t\tq := u.Query()\n\n\t\tfor k, v := range queryParameters {\n\t\t\t// this depends on the type of api, you may need to do it for each of v\n\t\t\tq.Set(k, strings.Join(v, \",\"))\n\t\t}\n\t\t// set the query to the encoded parameters\n\t\tu.RawQuery = q.Encode()\n\t}\n\n\t// regardless of GET or POST, we can safely add the body\n\treq, err := http.NewRequest(httpMethod, u.String(), body)\n\tif err != nil {\n\t\treturn responseType, err\n\t}\n\n\t// for each header passed, add the header value to the request\n\tfor k, v := range headers {\n\t\treq.Header.Set(k, v)\n\t}\n\n\t// optional: log the request for easier stack tracing\n\tlog.Printf(\"%s %s\\n\", httpMethod, req.URL.String())\n\n\t// finally, do the request\n\tres, err := client.Do(req)\n\tif err != nil {\n\t\treturn responseType, err\n\t}\n\n\tif res == nil {\n\t\treturn responseType, fmt.Errorf(\"error: calling %s returned empty response\", u.String())\n\t}\n\n\tresponseData, err := io.ReadAll(res.Body)\n\tif err != nil {\n\t\treturn responseType, err\n\t}\n\n\tdefer res.Body.Close()\n\n\tif res.StatusCode != http.StatusOK {\n\t\treturn responseType, fmt.Errorf(\"error calling %s:\\nstatus: %s\\nresponseData: %s\", u.String(), res.Status, responseData)\n\t}\n\n\tvar responseObject T\n\terr = json.Unmarshal(responseData, &responseObject)\n\n\tif err != nil {\n\t\tlog.Printf(\"error unmarshaling response: %+v\", err)\n\t\treturn responseType, err\n\t}\n\n\treturn responseObject, nil\n}\n",
                                    "language": "Go",
                                    "caretPosition": {
                                        "row": 0,
                                        "col": 0
                                    }
                                }
                            }
                        },
                        "main.go": {
                            "type": "file",
                            "content": "package main\n\nimport (\n\t\"bufio\"\n\t\"fmt\"\n\t\"log\"\n\t\"os\"\n\t\"sort\"\n\t\"strings\"\n\t\"time\"\n\n\t\"github.com/joho/godotenv\"\n\t\"solve.ch/solvers/http_helper\"\n)\n\ntype ContributionStats struct {\n\tUsername       string\n\tDailyCommits   int\n\tWeeklyCommits  int\n\tMonthlyCommits int\n\tYearlyCommits  int\n\tDailyMRs       int\n\tWeeklyMRs      int\n\tMonthlyMRs     int\n\tYearlyMRs      int\n\t// New field to store total pages fetched from GitLab\n\tPagesFetched int\n}\n\ntype TimePeriod struct {\n\tStart time.Time\n\tEnd   time.Time\n}\n\ntype GitLabAuthor struct {\n\tID        int    `json:\"id\"`\n\tUsername  string `json:\"username\"`\n\tName      string `json:\"name\"`\n\tState     string `json:\"state\"`\n\tAvatarURL string `json:\"avatar_url\"`\n\tWebURL    string `json:\"web_url\"`\n}\n\ntype GitLabPushData struct {\n\tCommitCount int    `json:\"commit_count\"`\n\tAction      string `json:\"action\"`\n\tRefType     string `json:\"ref_type\"`\n\tCommitFrom  string `json:\"commit_from\"`\n\tCommitTo    string `json:\"commit_to\"`\n\tRef         string `json:\"ref\"`\n\tCommitTitle string `json:\"commit_title\"`\n\tRefCount    *int   `json:\"ref_count\"`\n}\n\ntype GitLabEvent struct {\n\tID          int             `json:\"id\"`\n\tProjectID   int             `json:\"project_id\"`\n\tActionName  string          `json:\"action_name\"`\n\tTargetID    *int            `json:\"target_id\"`\n\tTargetIID   *int            `json:\"target_iid\"`\n\tTargetType  *string         `json:\"target_type\"`\n\tAuthorID    int             `json:\"author_id\"`\n\tTargetTitle *string         `json:\"target_title\"`\n\tCreatedAt   time.Time       `json:\"created_at\"`\n\tAuthor      GitLabAuthor    `json:\"author\"`\n\tPushData    *GitLabPushData `json:\"push_data\"`\n}\n\nfunc main() {\n\t// Load .env file\n\terr := godotenv.Load()\n\tif err != nil {\n\t\tlog.Println(\"Warning: Error loading .env file:\", err)\n\t}\n\n\t// Replace with your GitLab token\n\ttoken := os.Getenv(\"GITLAB_TOKEN\")\n\tif token == \"\" {\n\t\tlog.Fatal(\"GITLAB_TOKEN environment variable not set\")\n\t}\n\n\t// Read usernames from file\n\tusernames, err := readUsernames(\"usernames.txt\")\n\tif err != nil {\n\t\tlog.Fatalf(\"Failed to read usernames: %v\", err)\n\t}\n\n\t// Get contribution stats for each user\n\tstats := make([]ContributionStats, 0)\n\tfor _, username := range usernames {\n\t\tstat, err := getContributionStats(token, username)\n\t\tif err != nil {\n\t\t\tlog.Printf(\"Warning: Failed to get stats for %s: %v\", username, err)\n\t\t\tcontinue\n\t\t}\n\t\tstats = append(stats, stat)\n\t}\n\n\t// Sort by yearly commits (could be modified to use different metrics)\n\tsort.Slice(stats, func(i, j int) bool {\n\t\treturn stats[i].YearlyCommits > stats[j].YearlyCommits\n\t})\n\n\t// Print results with normalized bars\n\tprintResults(stats)\n}\n\nfunc readUsernames(filename string) ([]string, error) {\n\tfile, err := os.Open(filename)\n\tif err != nil {\n\t\treturn nil, err\n\t}\n\tdefer file.Close()\n\n\tvar usernames []string\n\tscanner := bufio.NewScanner(file)\n\tfor scanner.Scan() {\n\t\tusername := strings.TrimSpace(scanner.Text())\n\t\tif username != \"\" {\n\t\t\tusernames = append(usernames, username)\n\t\t}\n\t}\n\treturn usernames, scanner.Err()\n}\n\nfunc getContributionStats(token, username string) (ContributionStats, error) {\n\tstats := ContributionStats{Username: username}\n\n\t// Define time windows for daily, weekly, monthly, yearly\n\ttodayStart := time.Now().Truncate(24 * time.Hour)\n\ttodayEnd := todayStart.Add(24 * time.Hour)\n\n\t// last 7 days (including today)\n\tweekStart := todayStart.AddDate(0, 0, -6)\n\tweekEnd := todayEnd\n\n\t// last 1 month\n\tmonthStart := todayStart.AddDate(0, -1, 0)\n\tmonthEnd := todayEnd\n\n\t// last 1 year\n\tyearStart := todayStart.AddDate(-1, 0, 0)\n\tyearEnd := todayEnd\n\n\tperiods := map[string]TimePeriod{\n\t\t\"daily\": {\n\t\t\tStart: todayStart,\n\t\t\tEnd:   todayEnd,\n\t\t},\n\t\t\"weekly\": {\n\t\t\tStart: weekStart,\n\t\t\tEnd:   weekEnd,\n\t\t},\n\t\t\"monthly\": {\n\t\t\tStart: monthStart,\n\t\t\tEnd:   monthEnd,\n\t\t},\n\t\t\"yearly\": {\n\t\t\tStart: yearStart,\n\t\t\tEnd:   yearEnd,\n\t\t},\n\t}\n\n\t// We'll track how many pages we fetched total for each user\n\ttotalPages := 0\n\n\t// Get user's events for each time period\n\tfor period, timeRange := range periods {\n\t\tcommits, mrs, pages, err := GetUserActivity(token, username, timeRange.Start, timeRange.End)\n\t\tif err != nil {\n\t\t\treturn stats, err\n\t\t}\n\t\t// Accumulate total page count\n\t\ttotalPages += pages\n\n\t\tswitch period {\n\t\tcase \"daily\":\n\t\t\tstats.DailyCommits = commits\n\t\t\tstats.DailyMRs = mrs\n\t\tcase \"weekly\":\n\t\t\tstats.WeeklyCommits = commits\n\t\t\tstats.WeeklyMRs = mrs\n\t\tcase \"monthly\":\n\t\t\tstats.MonthlyCommits = commits\n\t\t\tstats.MonthlyMRs = mrs\n\t\tcase \"yearly\":\n\t\t\tstats.YearlyCommits = commits\n\t\t\tstats.YearlyMRs = mrs\n\t\t}\n\t}\n\n\t// Store the total pages fetched in stats\n\tstats.PagesFetched = totalPages\n\n\treturn stats, nil\n}\n\n// GetUserActivity returns the total commits, MRs, and the number of pages fetched\nfunc GetUserActivity(token, username string, start, end time.Time) (commits int, mrs int, totalPages int, err error) {\n\tbaseURL := \"https://git.solve.ch/api/v4/users\"\n\t// We will iterate over pages, so exclude &page from the base URL:\n\tfullURL := fmt.Sprintf(\n\t\t\"%s/%s/events?after=%s&before=%s&per_page=100\",\n\t\tbaseURL,\n\t\tusername,\n\t\tstart.Format(\"2006-01-02\"),\n\t\tend.Format(\"2006-01-02\"),\n\t)\n\n\theaders := map[string]string{\n\t\t\"PRIVATE-TOKEN\": token,\n\t}\n\n\tvar allEvents []GitLabEvent\n\tpage := 1\n\n\tfor {\n\t\t// Construct URL for the current page\n\t\tpagedURL := fmt.Sprintf(\"%s&page=%d\", fullURL, page)\n\n\t\tvar tempEvents []GitLabEvent\n\t\ttempEvents, err = http_helper.MakeHTTPRequestGeneric(\n\t\t\tpagedURL,\n\t\t\t\"GET\",\n\t\t\theaders,\n\t\t\tnil,\n\t\t\tnil,\n\t\t\ttempEvents,\n\t\t)\n\t\tif err != nil {\n\t\t\treturn 0, 0, 0, fmt.Errorf(\"failed to get user events (page %d): %v\", page, err)\n\t\t}\n\n\t\t// If no events, we've reached the end\n\t\tif len(tempEvents) == 0 {\n\t\t\tbreak\n\t\t}\n\n\t\t// Accumulate events\n\t\tallEvents = append(allEvents, tempEvents...)\n\t\tpage++\n\t}\n\n\t// The page - 1 is how many pages we actually fetched\n\ttotalPages = page - 1\n\n\t// Count commits and MRs\n\tfor _, event := range allEvents {\n\t\tswitch {\n\t\tcase event.ActionName == \"pushed to\" || event.ActionName == \"pushed new\":\n\t\t\tif event.PushData != nil {\n\t\t\t\tcommits += event.PushData.CommitCount\n\t\t\t}\n\t\tcase event.ActionName == \"accepted\" && event.TargetType != nil && *event.TargetType == \"MergeRequest\":\n\t\t\tmrs++\n\t\tcase event.ActionName == \"opened\" && event.TargetType != nil && *event.TargetType == \"MergeRequest\":\n\t\t\tmrs++\n\t\tdefault:\n\t\t\t// TODO: define a 'miscellaneous' category for other types of events\n\t\t\tcommits++\n\t\t}\n\t}\n\n\treturn commits, mrs, totalPages, nil\n}\n\nfunc printResults(stats []ContributionStats) {\n\n\t// loop over stats to get the average number of commits per merge request\n\tvar totalMRs, totalCommits int\n\tfor _, stat := range stats {\n\t\ttotalMRs += stat.YearlyMRs\n\t\ttotalCommits += stat.YearlyCommits\n\t}\n\n\taverageCommitsPerMR := int(float64(totalCommits) / float64(totalMRs))\n\n\t// Find maximum values for normalization\n\tvar maxDaily, maxWeekly, maxMonthly, maxYearly int\n\tfor _, stat := range stats {\n\t\tmaxDaily = max(maxDaily, stat.DailyCommits+(stat.DailyMRs*averageCommitsPerMR))\n\t\tmaxWeekly = max(maxWeekly, stat.WeeklyCommits+(stat.WeeklyMRs*averageCommitsPerMR))\n\t\tmaxMonthly = max(maxMonthly, stat.MonthlyCommits+(stat.MonthlyMRs*averageCommitsPerMR))\n\t\tmaxYearly = max(maxYearly, stat.YearlyCommits+(stat.YearlyMRs*averageCommitsPerMR))\n\t}\n\n\tvar maxDailyCommits, maxWeeklyCommits, maxMonthlyCommits, maxYearlyCommits int\n\tfor _, stat := range stats {\n\t\tmaxDailyCommits = max(maxDailyCommits, stat.DailyCommits)\n\t\tmaxWeeklyCommits = max(maxWeeklyCommits, stat.WeeklyCommits)\n\t\tmaxMonthlyCommits = max(maxMonthlyCommits, stat.MonthlyCommits)\n\t\tmaxYearlyCommits = max(maxYearlyCommits, stat.YearlyCommits)\n\t}\n\n\tvar maxDailyMRs, maxWeeklyMRs, maxMonthlyMRs, maxYearlyMRs int\n\tfor _, stat := range stats {\n\t\tmaxDailyMRs = max(maxDailyMRs, stat.DailyMRs)\n\t\tmaxWeeklyMRs = max(maxWeeklyMRs, stat.WeeklyMRs)\n\t\tmaxMonthlyMRs = max(maxMonthlyMRs, stat.MonthlyMRs)\n\t\tmaxYearlyMRs = max(maxYearlyMRs, stat.YearlyMRs)\n\t}\n\n\t// sort stats by scaled contributions (commts + scaled MRs)\n\tsort.Slice(stats, func(i, j int) bool {\n\t\treturn (stats[i].YearlyCommits + stats[i].YearlyMRs*averageCommitsPerMR) > (stats[j].YearlyCommits + stats[j].YearlyMRs*averageCommitsPerMR)\n\t})\n\n\tfmt.Println(\"\\n🏆 Top Contributors Overall\\n\")\n\tfmt.Printf(\"(MRs scaled by %dx, the global average commits per MR across Solve)\\n\", averageCommitsPerMR)\n\tfmt.Println(\"========================\")\n\n\temojisByRank := []string{\"🥇\", \"🥈\", \"🥉\"}\n\n\tfor index, stat := range stats {\n\t\t// Use the index to get the corresponding emoji - if we are less than three, use the list\n\t\temoji := \"👨‍💻\"\n\t\tif index < len(emojisByRank) {\n\t\t\temoji = emojisByRank[index]\n\t\t}\n\t\tfmt.Printf(\"\\n%s %s\\n\", emoji, stat.Username)\n\t\tfmt.Printf(\"   (Fetched %d pages from GitLab)\\n\", stat.PagesFetched)\n\n\t\t// Print daily, weekly, monthly, yearly bars\n\t\tprintBar(\"Today    \", stat.DailyCommits+(stat.DailyMRs*averageCommitsPerMR), maxDaily)\n\t\tprintBar(\"Week     \", stat.WeeklyCommits+(stat.WeeklyMRs*averageCommitsPerMR), maxWeekly)\n\t\tprintBar(\"Month    \", stat.MonthlyCommits+(stat.MonthlyMRs*averageCommitsPerMR), maxMonthly)\n\t\tprintBar(\"Year     \", stat.YearlyCommits+(stat.YearlyMRs*averageCommitsPerMR), maxYearly)\n\n\t\tfmt.Printf(\"Details: %d commits, %d MRs in the past year. Total Score: %d\\n\",\n\t\t\tstat.YearlyCommits, stat.YearlyMRs, stat.YearlyCommits+(stat.YearlyMRs*averageCommitsPerMR))\n\t}\n\n\t// sort stats by commits now\n\tsort.Slice(stats, func(i, j int) bool {\n\t\treturn stats[i].YearlyCommits > stats[j].YearlyCommits\n\t})\n\n\tfmt.Println(\"\\n🏆 Top Committers\")\n\tfmt.Println(\"========================\")\n\n\tfor index, stat := range stats {\n\t\t// Use the index to get the corresponding emoji - if we are less than three, use the list\n\t\temoji := \"👨‍💻\"\n\t\tif index < len(emojisByRank) {\n\t\t\temoji = emojisByRank[index]\n\t\t}\n\t\tfmt.Printf(\"\\n%s %s\\n\", emoji, stat.Username)\n\t\tfmt.Printf(\"   (Fetched %d pages from GitLab)\\n\", stat.PagesFetched)\n\n\t\t// Print daily, weekly, monthly, yearly bars\n\t\tprintBar(\"Today    \", stat.DailyCommits, maxDailyCommits)\n\t\tprintBar(\"Week     \", stat.WeeklyCommits, maxWeeklyCommits)\n\t\tprintBar(\"Month    \", stat.MonthlyCommits, maxMonthlyCommits)\n\t\tprintBar(\"Year     \", stat.YearlyCommits, maxYearlyCommits)\n\n\t\tfmt.Printf(\"Details: %d commits in the past year\\n\",\n\t\t\tstat.YearlyCommits)\n\t}\n\n\t// sort stats by MRs now\n\tsort.Slice(stats, func(i, j int) bool {\n\t\treturn stats[i].YearlyMRs > stats[j].YearlyMRs\n\t})\n\n\tfmt.Println(\"\\n🏆 Top Merge Requesters\")\n\tfmt.Println(\"========================\")\n\n\tfor index, stat := range stats {\n\t\t// Use the index to get the corresponding emoji - if we are less than three, use the list\n\t\temoji := \"👨‍💻\"\n\t\tif index < len(emojisByRank) {\n\t\t\temoji = emojisByRank[index]\n\t\t}\n\t\tfmt.Printf(\"\\n%s %s\\n\", emoji, stat.Username)\n\t\tfmt.Printf(\"   (Fetched %d pages from GitLab)\\n\", stat.PagesFetched)\n\n\t\t// Print daily, weekly, monthly, yearly bars\n\t\tprintBar(\"Today    \", stat.DailyMRs, maxDailyMRs)\n\t\tprintBar(\"Week     \", stat.WeeklyMRs, maxWeeklyMRs)\n\t\tprintBar(\"Month    \", stat.MonthlyMRs, maxMonthlyMRs)\n\t\tprintBar(\"Year     \", stat.YearlyMRs, maxYearlyMRs)\n\n\t\tfmt.Printf(\"Details: %d MRs in the past year\\n\",\n\t\t\tstat.YearlyMRs)\n\t}\n}\n\nfunc printBar(label string, value, maxValue int) {\n\tconst barWidth = 30\n\tvar percentage float64\n\tif maxValue > 0 {\n\t\tpercentage = float64(value) / float64(maxValue) * 100\n\t}\n\n\tfilledWidth := int(float64(barWidth) * percentage / 100)\n\tbar := strings.Repeat(\"█\", filledWidth) + strings.Repeat(\"░\", barWidth-filledWidth)\n\n\tfmt.Printf(\"%s [%s] %.1f%% (%d)\\n\", label, bar, percentage, value)\n}\n\nfunc max(a, b int) int {\n\tif a > b {\n\t\treturn a\n\t}\n\treturn b\n}\n",
                            "language": "Go",
                            "caretPosition": {
                                "row": 0,
                                "col": 0
                            }
                        },
                        "main_test.go": {
                            "type": "file",
                            "content": "package main\n\nimport (\n\t\"log\"\n\t\"os\"\n\t\"testing\"\n\t\"time\"\n\n\t\"github.com/joho/godotenv\"\n\t\"solve.ch/solvers/http_helper\"\n)\n\nfunc TestGetUserActivity(t *testing.T) {\n\t// Load .env file\n\terr := godotenv.Load()\n\tif err != nil {\n\t\tlog.Println(\"Warning: Error loading .env file:\", err)\n\t}\n\n\t// Get GitLab token from environment\n\ttoken := os.Getenv(\"GITLAB_TOKEN\")\n\tif token == \"\" {\n\t\tt.Fatal(\"GITLAB_TOKEN environment variable not set\")\n\t}\n\n\t// Set up time range for last 7 days\n\tnow := time.Now()\n\tsevenDaysAgo := now.AddDate(0, 0, -7)\n\n\t// Test GetUserActivity function\n\tcommits, mrs, err := GetUserActivity(token, \"cfrewin\", sevenDaysAgo, now)\n\tif err != nil {\n\t\tt.Fatalf(\"GetUserActivity failed: %v\", err)\n\t}\n\n\t// Log the results\n\tt.Logf(\"Activity for user 'cfrewin' in the last 7 days:\")\n\tt.Logf(\"Commits: %d\", commits)\n\tt.Logf(\"Merge Requests: %d\", mrs)\n\n\t// From the sample JSON, we can see several commits and MRs\n\t// Let's add some basic assertions\n\tif commits == 0 {\n\t\tt.Log(\"Warning: No commits found in the last 7 days\")\n\t}\n\tif mrs < 0 {\n\t\tt.Error(\"Number of merge requests should not be negative\")\n\t}\n\n\t// Add detailed logging of commits by looking at the raw response\n\tresponseData, err := http_helper.MakeHTTPRequest(\n\t\t\"https://git.solve.ch/api/v4/users/cfrewin/events\",\n\t\t\"GET\",\n\t\tmap[string]string{\"PRIVATE-TOKEN\": token},\n\t\tnil,\n\t\tnil,\n\t)\n\tif err != nil {\n\t\tt.Logf(\"Failed to get raw events: %v\", err)\n\t} else {\n\t\tt.Logf(\"Raw response: %s\", string(responseData))\n\t}\n}\n",
                            "language": "Go",
                            "caretPosition": {
                                "row": 0,
                                "col": 0
                            }
                        },
                        "usernames.txt": {
                            "type": "file",
                            "content": "cfrewin\nsgacond\nthuber\nsgulas\nvkamberi\nurust\nsreber\nsrupp\nmsobotka\ndavid.ritter\nrlauber\nmkohler\nakati\nmhemmi\njheron",
                            "language": "Plain Text",
                            "caretPosition": {
                                "row": 0,
                                "col": 0
                            }
                        }
                    }
                },
                "editorSnapshot": {
                    "isEditorContextMenuOpen": false,
                    "editors": []
                },
                "terminalSnapshot": {
                    "terminals": []
                },
                "mouseSnapshot": {
                    "location": "editor",
                    "currentHoveredFileName": "",
                    "currentHoveredFolderName": "",
                    "currentHoveredEditorTabFileName": "",
                    "x": 0,
                    "y": 0,
                    "timestamp": 0,
                    "type": "move",
                    "buttonStates": {
                        "left": false,
                        "right": false,
                        "middle": false
                    },
                    "scrollPosition": {
                        "x": 0,
                        "y": 0
                    }
                },
                "authorSnapshot": {
                    "authors": [
                        {
                            "currentSpeechCaption": ""
                        }
                    ]
                }
            }
        }
    }
]

// returns a JSON representation of an example lesson based on keywords
// the LLM can use this to learn real example lessons created by humans
export const getExampleLessonByKeyword = (keyword: string | string[]): string => {
    const exampleJSONs: string[] = [];

    if (Array.isArray(keyword)) {
        // if the keyword is an array, loop over all keywords and get the example lesson for each one
        for (var i = 0; i < keyword.length; i++) {
            const exampleJSON = getExampleLessonByKeyword(keyword[i]);
            exampleJSONs.push(exampleJSON);
        }
        return exampleJSONs.join(", ");
    } else {
        // if the keyword is a string, get the example lesson for that keyword
        const exampleJSON = getSingleExampleLesson(keyword);
        if (exampleJSON) {
            return exampleJSON;
        }
    }
    // if no keywords match, return an empty string
    return "";
}

const getSingleExampleLesson = (keyword: string): string => {
    // loop over all keywords and find the first one that matches
    for (var i = 0; i < keywordsToExampleLessonsMap.length; i++) {
        const keywordMap = keywordsToExampleLessonsMap[i];
        if (keywordMap.keywords.includes(keyword)) {
            return JSON.stringify(keywordMap.lesson, null, 2);
        }
    }

    // if no keywords match, return an empty string
    return "";
}