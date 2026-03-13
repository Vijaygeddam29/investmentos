#!/bin/bash
echo "📦 Backing up InvestmentOS to GitHub..."
echo ""

# Stage all changes
git add -A

# Commit with timestamp
TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
git commit -m "Backup: $TIMESTAMP" 2>/dev/null || echo "Nothing new to commit — already up to date."

# Push to GitHub
echo ""
echo "Pushing to https://github.com/Vijaygeddam29/investmentos"
echo "When prompted:"
echo "  Username: Vijaygeddam29"
echo "  Password: paste your GitHub Personal Access Token (not your password)"
echo ""
git push github master

echo ""
echo "✅ Done! View at: https://github.com/Vijaygeddam29/investmentos"
