#!/bin/bash
echo "Backing up InvestmentOS to GitHub..."

git add -A

TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
git commit -m "Backup: $TIMESTAMP" 2>/dev/null || echo "Nothing new to commit — already up to date."

git push github master

echo ""
echo "Done! View at: https://github.com/Vijaygeddam29/investmentos"
