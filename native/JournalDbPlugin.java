package com.dawit.mobjournal;

import android.database.Cursor;
import android.database.DatabaseUtils;
import android.database.sqlite.SQLiteDatabase;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;

/**
 * Minimal bridge to Android's built-in SQLite. No extra libraries.
 * JS side: Capacitor.Plugins.JournalDb.{query, run, batch}
 */
@CapacitorPlugin(name = "JournalDb")
public class JournalDbPlugin extends Plugin {

    private SQLiteDatabase db;

    private synchronized SQLiteDatabase db() {
        if (db == null || !db.isOpen()) {
            File file = getContext().getDatabasePath("journal.db");
            File dir = file.getParentFile();
            if (dir != null && !dir.exists()) dir.mkdirs();
            db = SQLiteDatabase.openOrCreateDatabase(file, null);
            db.setForeignKeyConstraintsEnabled(true);
        }
        return db;
    }

    /** JSON array -> bind args (null / Long / Double / String). */
    private static Object[] toArgs(JSONArray arr) throws JSONException {
        if (arr == null) return new Object[0];
        Object[] out = new Object[arr.length()];
        for (int i = 0; i < arr.length(); i++) {
            Object v = arr.get(i);
            if (v == JSONObject.NULL) out[i] = null;
            else if (v instanceof Boolean) out[i] = ((Boolean) v) ? 1L : 0L;
            else if (v instanceof Integer) out[i] = ((Integer) v).longValue();
            else if (v instanceof Long || v instanceof Double) out[i] = v;
            else if (v instanceof Number) out[i] = ((Number) v).doubleValue();
            else out[i] = String.valueOf(v);
        }
        return out;
    }

    @PluginMethod
    public void query(PluginCall call) {
        String sql = call.getString("sql");
        if (sql == null) { call.reject("sql is required"); return; }
        Cursor c = null;
        try {
            Object[] args = toArgs(call.getArray("params"));
            // rawQuery only binds strings; SQLite applies column affinity, so numbers still compare correctly.
            String[] sargs = new String[args.length];
            for (int i = 0; i < args.length; i++) {
                if (args[i] == null) { call.reject("null param in query at index " + i); return; }
                sargs[i] = String.valueOf(args[i]);
            }
            c = db().rawQuery(sql, sargs);
            JSArray rows = new JSArray();
            String[] names = c.getColumnNames();
            while (c.moveToNext()) {
                JSObject row = new JSObject();
                for (int i = 0; i < names.length; i++) {
                    switch (c.getType(i)) {
                        case Cursor.FIELD_TYPE_NULL: row.put(names[i], JSONObject.NULL); break;
                        case Cursor.FIELD_TYPE_INTEGER: row.put(names[i], c.getLong(i)); break;
                        case Cursor.FIELD_TYPE_FLOAT: row.put(names[i], c.getDouble(i)); break;
                        case Cursor.FIELD_TYPE_BLOB: row.put(names[i], Base64.encodeToString(c.getBlob(i), Base64.NO_WRAP)); break;
                        default: row.put(names[i], c.getString(i));
                    }
                }
                rows.put(row);
            }
            JSObject res = new JSObject();
            res.put("rows", rows);
            call.resolve(res);
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()), e);
        } finally {
            if (c != null) c.close();
        }
    }

    @PluginMethod
    public void run(PluginCall call) {
        String sql = call.getString("sql");
        if (sql == null) { call.reject("sql is required"); return; }
        try {
            SQLiteDatabase d = db();
            d.execSQL(sql, toArgs(call.getArray("params")));
            JSObject res = new JSObject();
            res.put("changes", DatabaseUtils.longForQuery(d, "SELECT changes()", null));
            call.resolve(res);
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()), e);
        }
    }

    /** statements: [{ sql, params }] executed in one transaction (all or nothing). */
    @PluginMethod
    public void batch(PluginCall call) {
        JSArray statements = call.getArray("statements");
        if (statements == null) { call.reject("statements is required"); return; }
        SQLiteDatabase d = db();
        d.beginTransaction();
        try {
            for (int i = 0; i < statements.length(); i++) {
                JSONObject st = statements.getJSONObject(i);
                d.execSQL(st.getString("sql"), toArgs(st.optJSONArray("params")));
            }
            d.setTransactionSuccessful();
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()), e);
        } finally {
            d.endTransaction();
        }
    }
}
