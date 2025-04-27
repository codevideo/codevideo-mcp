const keywordRepoMap: Array<{ keywords: string[], repoPath: string}> = [
    {
        keywords: ["codevideo.io", "CodeVideo homepage"],
        repoPath: "/Users/chris/enterprise/codevideo/codevideo.io"
    },
    {
        keywords: ["studio.codevideo.io", "Studio", "CodeVideo Studio"],
        repoPath: "/Users/chris/enterprise/codevideo/studio.codevideo.io"
    },
    {
        keywords: ["Types", "CodeVideo Types"],
        repoPath: "/Users/chris/enterprise/codevideo/codevideo-types"
    },
    {
        keywords: ["React IDE", "CodeVideo React IDE"],
        repoPath: "/Users/chris/enterprise/codevideo/codevideo-ide-react"
    },
    {
        keywords: ["virtual IDE", "CodeVideo Virtual IDE"],
        repoPath: "/Users/chris/enterprise/codevideo/codevideo-virtual-ide"
    },
    // virtual file explorer
    {
        keywords: ["virtual file explorer", "CodeVideo Virtual File Explorer"],
        repoPath: "/Users/chris/enterprise/codevideo/codevideo-virtual-file-explorer"
    },
    // virtual terminal
    {
        keywords: ["virtual terminal", "CodeVideo Virtual Terminal"],
        repoPath: "/Users/chris/enterprise/codevideo/codevideo-virtual-terminal"
    },
    // virtual mouse
    {
        keywords: ["virtual mouse", "CodeVideo Virtual Mouse"],
        repoPath: "/Users/chris/enterprise/codevideo/codevideo-virtual-mouse"
    },
    // virtual author
    {
        keywords: ["virtual author", "CodeVideo Virtual Author"],
        repoPath: "/Users/chris/enterprise/codevideo/codevideo-virtual-author"
    },
]

// Calculate Levenshtein distance between two strings
function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            const cost = a[j - 1] === b[i - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // deletion
                matrix[i][j - 1] + 1,      // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }

    return matrix[b.length][a.length];
}

// returns the relevant repo path based on the keyword provided
// if no matching keyword is found, it gives context of the nearest matches, i.e. "did you mean...?"
export const listRepoLocations = async (keyword: string) => {
    const keywordLower = keyword.toLowerCase();
    
    // First try exact or substring matches
    const exactMatches = keywordRepoMap.filter(repo => 
        repo.keywords.some(kw => kw.toLowerCase().includes(keywordLower))
    );

    if (exactMatches.length > 0) {
        return {
            content: [{
                type: "text",
                text: `Found matching repo(s): ${exactMatches.map(repo => repo.repoPath).join(", ")}`
            }],
            isError: false
        };
    } else {
        // If no exact matches, find fuzzy matches using Levenshtein distance
        const DISTANCE_THRESHOLD = 3; // Max edit distance to consider a word similar
        
        // Calculate distance for each keyword and find the closest matches
        const fuzzyMatches: Array<{repo: typeof keywordRepoMap[0], keyword: string, distance: number}> = [];
        
        for (const repo of keywordRepoMap) {
            for (const kw of repo.keywords) {
                const distance = levenshteinDistance(keywordLower, kw.toLowerCase());
                if (distance <= DISTANCE_THRESHOLD) {
                    fuzzyMatches.push({repo, keyword: kw, distance});
                }
            }
        }
        
        // Sort by distance (closest matches first)
        fuzzyMatches.sort((a, b) => a.distance - b.distance);
        
        if (fuzzyMatches.length > 0) {
            // Get unique repo paths from the closest matches
            const uniqueMatchedRepos = Array.from(new Set(
                fuzzyMatches.map(match => match.repo.repoPath)
            ));
            
            // Show suggested keywords along with their repos
            const suggestions = fuzzyMatches
                .slice(0, 5) // Limit to top 5 suggestions
                .map(match => `${match.keyword} (${match.repo.repoPath})`)
                .join(", ");
                
            return {
                content: [{
                    type: "text",
                    text: `No exact matches found for '${keyword}'. Did you mean: ${suggestions}?`
                }],
                isError: true
            };
        } else {
            // No matches at all
            return {
                content: [{
                    type: "text",
                    text: `No matching repo found for '${keyword}'. Available keywords: ${keywordRepoMap.map(repo => repo.keywords.join(", ")).join("; ")}`
                }],
                isError: true
            };
        }
    }
}