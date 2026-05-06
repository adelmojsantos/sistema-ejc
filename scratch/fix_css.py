
import sys

file_path = r'c:\Users\adelmo\Desktop\personal\sistema-ejc\src\index.css'

with open(file_path, 'rb') as f:
    content = f.read()

# Find the last '}' that is not corrupted
# The corrupted part starts after '}\n' or '}\r\n'
last_valid_marker = b'}\n'
if last_valid_marker not in content:
    last_valid_marker = b'}\r\n'

parts = content.split(last_valid_marker)
# We assume the last part is the one that got corrupted if it contains null bytes
# Actually, the 'echo' might have written UTF-16
# Let's just truncate at the last valid marker and add the new content

new_css = b"""
/* Public Forms Logo */
.public-logo-img {
  transition: filter 0.3s ease;
}

.dark .public-logo-img {
  filter: brightness(0) invert(1) !important;
}
"""

# Find the last index of mc-content-appear block
target_index = content.rfind(b'mc-content-appear')
if target_index != -1:
    # Find the next '}' after mc-content-appear
    closing_brace_index = content.find(b'}', target_index)
    if closing_brace_index != -1:
        # Check if there is a second '}' (for the @keyframes itself)
        second_closing_brace_index = content.find(b'}', closing_brace_index + 1)
        if second_closing_brace_index != -1:
            truncated_content = content[:second_closing_brace_index + 1]
            with open(file_path, 'wb') as f:
                f.write(truncated_content)
                f.write(new_css)
            print("Successfully fixed index.css")
        else:
            print("Could not find second closing brace")
    else:
        print("Could not find first closing brace")
else:
    print("Could not find mc-content-appear")
