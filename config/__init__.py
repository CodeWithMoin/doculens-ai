"""
Compatibility layer to support legacy imports of `config` modules.

The project structure moved to `app.config`, but some tests and tools still
reference `config`. Importing from this package defers to the new location.
"""
