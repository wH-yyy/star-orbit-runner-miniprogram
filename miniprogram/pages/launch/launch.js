// pages/launch/launch.js
Page({
  onLoad: function() {
    const app = getApp();
    
    // 显示加载动画
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
    
    // 检查登录状态并跳转
    setTimeout(() => {
      wx.hideLoading();
      
      if (app.globalData.hasLogin) {
        wx.switchTab({
          url: '/pages/submit/submit'
        });
      } else {
        wx.reLaunch({
          url: '/pages/phone-login/phone-login'
        });
      }
    }, 1500); // 模拟加载时间
  }
});