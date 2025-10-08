import { useState, useEffect } from 'react';

// Switch Alert Component สำหรับการยืนยัน
export const SwitchAlert = ({ show, title, message, type = "info", buttons = ["OK"], onClose, onConfirm }) => {
  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [show]);

  if (!show) return null;

  const getAlertStyles = () => {
    switch (type) {
      case "success":
        return {
          icon: "✓",
          iconColor: "text-green-500",
          borderColor: "border-green-200"
        };
      case "error":
        return {
          icon: "✕",
          iconColor: "text-red-500",
          borderColor: "border-red-200"
        };
      case "warning":
        return {
          icon: "⚠",
          iconColor: "text-yellow-500",
          borderColor: "border-yellow-200"
        };
      default:
        return {
          icon: "ℹ",
          iconColor: "text-blue-500",
          borderColor: "border-blue-200"
        };
    }
  };

  const styles = getAlertStyles();

  const handleButtonClick = (buttonIndex) => {
    if (buttonIndex === buttons.length - 1) {
      // ปุ่มสุดท้าย = ยืนยัน
      onConfirm && onConfirm(true);
    } else {
      // ปุ่มอื่น = ยกเลิก
      onConfirm && onConfirm(false);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
      <div className={`bg-white rounded-xl shadow-xl max-w-md w-full mx-4 border ${styles.borderColor}`}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className={`text-2xl ${styles.iconColor}`}>
              {styles.icon}
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
          
          {/* Message */}
          <div className="mb-6">
            <p className="text-gray-700 leading-relaxed">{message}</p>
          </div>
          
          {/* Buttons */}
          <div className="flex gap-3 justify-end">
            {buttons.map((button, index) => (
              <button
                key={index}
                onClick={() => handleButtonClick(index)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  index === buttons.length - 1
                    ? type === "error" 
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : type === "warning"
                      ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-800"
                }`}
              >
                {button}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Notification Component ที่สวยงามแทน alert()
export const Notification = ({ show, message, type = "info", onClose, duration = 3000 }) => {
  useEffect(() => {
    if (show && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

  if (!show) return null;

  const getNotificationStyles = () => {
    switch (type) {
      case "success":
        return {
          container: "bg-green-50 border-green-200 text-green-800",
          dot: "bg-green-500",
          icon: "✓"
        };
      case "error":
        return {
          container: "bg-red-50 border-red-200 text-red-800",
          dot: "bg-red-500",
          icon: "✕"
        };
      case "warning":
        return {
          container: "bg-yellow-50 border-yellow-200 text-yellow-800",
          dot: "bg-yellow-500",
          icon: "⚠"
        };
      default:
        return {
          container: "bg-blue-50 border-blue-200 text-blue-800",
          dot: "bg-blue-500",
          icon: "ℹ"
        };
    }
  };

  const styles = getNotificationStyles();

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div className={`rounded-lg shadow-lg border p-4 max-w-sm ${styles.container}`}>
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${styles.dot}`}></div>
          <span className="text-sm font-medium flex-1">{message}</span>
          <button
            onClick={onClose}
            className="ml-auto text-slate-400 hover:text-slate-600 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

// Hook สำหรับใช้ notification
export const useNotification = () => {
  const [notification, setNotification] = useState({ 
    show: false, 
    message: "", 
    type: "info" 
  });

  const showNotification = (message, type = "info", duration = 3000) => {
    setNotification({ show: true, message, type });
    
    if (duration > 0) {
      setTimeout(() => {
        setNotification({ show: false, message: "", type: "info" });
      }, duration);
    }
  };

  const hideNotification = () => {
    setNotification({ show: false, message: "", type: "info" });
  };

  return {
    notification,
    showNotification,
    hideNotification
  };
};

// Hook สำหรับใช้ switch alert
export const useSwitchAlert = () => {
  const [switchAlert, setSwitchAlert] = useState({
    show: false,
    title: "",
    message: "",
    type: "info",
    buttons: ["OK"]
  });

  const showSwitchAlert = ({ title, message, type = "info", buttons = ["OK"] }) => {
    return new Promise((resolve) => {
      setSwitchAlert({
        show: true,
        title,
        message,
        type,
        buttons
      });

      // เก็บ resolve function ไว้ใน state
      setSwitchAlert(prev => ({
        ...prev,
        onConfirm: (confirmed) => {
          resolve(confirmed);
        }
      }));
    });
  };

  const hideSwitchAlert = () => {
    setSwitchAlert({
      show: false,
      title: "",
      message: "",
      type: "info",
      buttons: ["OK"]
    });
  };

  return {
    switchAlert,
    showSwitchAlert,
    hideSwitchAlert
  };
};

export default Notification;
