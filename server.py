from flask import Flask, send_from_directory
import os

app = Flask(__name__)

# Serve static files from web directory
@app.route('/')
def root():
    return send_from_directory('.', 'index.html')

@app.route('/web/<path:path>')
def serve_web(path):
    return send_from_directory('web', path)

@app.route('/outputs_20250119_182234/<path:path>')
def serve_outputs(path):
    return send_from_directory('outputs_20250119_182234', path)

# Serve data files
@app.route('/data/<path:path>')
def data_files(path):
    return send_from_directory('data', path)

if __name__ == '__main__':
    app.run(debug=True, port=3000)
