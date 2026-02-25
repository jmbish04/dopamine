import glob
import os

files = glob.glob('onion_tasker_dashboard/*.html')
files.sort()

for file_path in files:
    with open(file_path, 'r') as f:
        lines = f.readlines()

    new_lines = []
    seen_links = set()
    modified = False

    for line in lines:
        if 'family=Material+Symbols+Outlined' in line:
            stripped = line.strip()
            if stripped in seen_links:
                print(f"Removing duplicate line in {os.path.basename(file_path)}:\n  {stripped}")
                modified = True
                continue
            seen_links.add(stripped)
        new_lines.append(line)

    if modified:
        with open(file_path, 'w') as f:
            f.writelines(new_lines)

print("Finished processing.")
