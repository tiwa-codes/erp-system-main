import os

replacements = [
    ('bg-blue-600', 'bg-[#BE1522]'),
    ('bg-blue-700', 'bg-[#9B1219]'),
    ('bg-blue-500', 'bg-[#BE1522]'),
    ('hover:bg-blue-700', 'hover:bg-[#9B1219]'),
    ('hover:bg-blue-600', 'hover:bg-[#BE1522]'),
    ('hover:bg-blue-500', 'hover:bg-[#9B1219]'),
    ('hover:bg-blue-800', 'hover:bg-[#7A0E14]'),
    ('shadow-blue-200', 'shadow-red-200'),
]

changed_files = []
for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in ['node_modules', '.next', '.git']]
    for fname in files:
        if not (fname.endswith('.tsx') or fname.endswith('.ts')):
            continue
        fpath = os.path.join(root, fname)
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception:
            continue
        new_content = content
        for old, new in replacements:
            new_content = new_content.replace(old, new)
        if new_content != content:
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            changed_files.append(fpath)

print(f"Changed {len(changed_files)} files")
for fp in changed_files[:15]:
    print(f" - {fp}")
if len(changed_files) > 15:
    print(f" ... and {len(changed_files)-15} more")
