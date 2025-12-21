#!/usr/bin/env python3
"""
Auto-setup script for WhatsApp service dependencies.
This script runs on backend startup to ensure Node.js and WhatsApp service are available.
"""

import os
import subprocess
import sys
import time
import logging
import urllib.request
import platform

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

WHATSAPP_SERVICE_DIR = '/app/whatsapp-service'
NODE_VERSION = 'v20.11.0'

def get_node_url():
    """Get the correct Node.js URL for the current architecture"""
    arch = platform.machine()
    if arch == 'x86_64':
        node_arch = 'x64'
    elif arch == 'aarch64' or arch == 'arm64':
        node_arch = 'arm64'
    else:
        node_arch = 'x64'
    return f'https://nodejs.org/dist/{NODE_VERSION}/node-{NODE_VERSION}-linux-{node_arch}.tar.xz'

def run_command(cmd, timeout=120, cwd=None):
    """Run a command and return (success, stdout, stderr)"""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=cwd)
        return result.returncode == 0, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return False, "", "Timeout"
    except Exception as e:
        return False, "", str(e)

def check_node():
    """Check if Node.js is installed"""
    paths = ['/usr/local/bin/node', '/usr/bin/node']
    for path in paths:
        if os.path.exists(path):
            success, stdout, _ = run_command([path, '--version'], timeout=5)
            if success:
                return True, stdout.strip(), path
    return False, None, None

def check_npm():
    """Check if NPM is installed"""
    paths = ['/usr/local/bin/npm', '/usr/bin/npm']
    for path in paths:
        if os.path.exists(path):
            success, stdout, _ = run_command([path, '--version'], timeout=5)
            if success:
                return True, stdout.strip(), path
    return False, None, None

def check_whatsapp_deps():
    """Check if WhatsApp service dependencies are installed"""
    node_modules = os.path.join(WHATSAPP_SERVICE_DIR, 'node_modules', '@whiskeysockets')
    return os.path.exists(node_modules)

def check_whatsapp_service():
    """Check if WhatsApp service is running"""
    try:
        import urllib.request
        req = urllib.request.Request('http://localhost:3002/health', method='GET')
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status == 200
    except:
        return False

def install_node():
    """Install Node.js using Python urllib"""
    logger.info(f"Installing Node.js {NODE_VERSION}...")
    
    node_url = get_node_url()
    node_file = '/tmp/node.tar.xz'
    
    logger.info(f"Downloading from {node_url}...")
    
    try:
        urllib.request.urlretrieve(node_url, node_file)
        logger.info("Download completed")
    except Exception as e:
        logger.error(f"Download failed: {e}")
        return False
    
    # Extract
    logger.info("Extracting files...")
    success, stdout, stderr = run_command(
        ['tar', '-xJf', node_file, '-C', '/usr/local', '--strip-components=1'],
        timeout=180
    )
    if not success:
        logger.error(f"Extraction failed: {stderr}")
        return False
    
    # Cleanup
    try:
        os.remove(node_file)
    except:
        pass
    
    # Verify
    installed, version, _ = check_node()
    if installed:
        logger.info(f"Node.js installed successfully: {version}")
        return True
    else:
        logger.error("Node.js installation failed - not found after install")
        return False

def install_whatsapp_deps():
    """Install WhatsApp service dependencies"""
    logger.info("Installing WhatsApp service dependencies...")
    
    _, _, npm_path = check_npm()
    if not npm_path:
        npm_path = '/usr/local/bin/npm'
    
    success, stdout, stderr = run_command(
        [npm_path, 'install'],
        timeout=300,
        cwd=WHATSAPP_SERVICE_DIR
    )
    
    if check_whatsapp_deps():
        logger.info("WhatsApp dependencies installed successfully")
        return True
    else:
        logger.error(f"Failed to install dependencies: {stderr}")
        return False

def start_whatsapp_service():
    """Start WhatsApp service in background"""
    logger.info("Starting WhatsApp service...")
    
    _, _, node_path = check_node()
    if not node_path:
        node_path = '/usr/local/bin/node'
    
    env = os.environ.copy()
    env['PATH'] = f"/usr/local/bin:{env.get('PATH', '')}"
    
    # Start as background process
    process = subprocess.Popen(
        [node_path, 'index.js'],
        cwd=WHATSAPP_SERVICE_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        start_new_session=True
    )
    
    # Wait a bit and check
    time.sleep(3)
    
    if check_whatsapp_service():
        logger.info("WhatsApp service started successfully")
        return True
    
    # Wait a bit more
    time.sleep(2)
    if check_whatsapp_service():
        logger.info("WhatsApp service started successfully")
        return True
    
    logger.warning("WhatsApp service may still be starting...")
    return True  # Don't fail, it might still be starting

def main():
    """Main setup function"""
    logger.info("=" * 50)
    logger.info("WhatsApp Service Auto-Setup Starting...")
    logger.info("=" * 50)
    
    # Check if WhatsApp service directory exists
    if not os.path.exists(WHATSAPP_SERVICE_DIR):
        logger.error(f"WhatsApp service directory not found: {WHATSAPP_SERVICE_DIR}")
        return False
    
    # Step 1: Check/Install Node.js
    node_installed, node_version, _ = check_node()
    if not node_installed:
        logger.info("Node.js not found, installing...")
        if not install_node():
            logger.error("Failed to install Node.js")
            return False
    else:
        logger.info(f"Node.js already installed: {node_version}")
    
    # Step 2: Check/Install WhatsApp dependencies
    if not check_whatsapp_deps():
        logger.info("WhatsApp dependencies not found, installing...")
        if not install_whatsapp_deps():
            logger.error("Failed to install WhatsApp dependencies")
            return False
    else:
        logger.info("WhatsApp dependencies already installed")
    
    # Step 3: Start WhatsApp service if not running
    if not check_whatsapp_service():
        logger.info("WhatsApp service not running, starting...")
        start_whatsapp_service()
    else:
        logger.info("WhatsApp service already running")
    
    logger.info("=" * 50)
    logger.info("Auto-Setup Complete!")
    logger.info("=" * 50)
    
    return True

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
