// pages/awards/awards.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    totalActivities: 60, // 总活动次数（固定为60次）
    userParticipations: 0, // 用户参与次数（从数据库获取）
    participationRate: 0, // 参与比例
    userAward: "", // 用户奖项
    symbols: {
      greaterEqual: "≥",
      lessThan: "<"
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.loadUserParticipations();
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    // 每次显示页面时重新获取参与次数并计算奖项，确保数据最新
    this.loadUserParticipations();
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {
    // 下拉刷新时重新获取参与次数并计算奖项
    this.loadUserParticipations();
    wx.stopPullDownRefresh();
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {

  },

  /**
   * 加载用户参与次数
   */
  async loadUserParticipations() {
    try {
      // 获取当前用户信息
      const app = getApp();
      const openid = app.globalData.userInfo?.openid || wx.getStorageSync('openid');
      
      if (!openid) {
        console.error('未获取到用户openid');
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        return;
      }
      
      // 从数据库获取用户信息，包含打卡记录次数
      const db = wx.cloud.database();
      const res = await db.collection('Users')
        .where({
          openid: openid
        })
        .get();
      
      if (res.data.length > 0) {
        const userInfo = res.data[0];
        // 获取用户的打卡记录次数作为参与次数
        const userParticipations = userInfo.totalCount || 0;
        
        // 更新用户参与次数
        this.setData({
          userParticipations
        });
        
        // 计算奖项
        this.calculateAward();
      }
    } catch (error) {
      console.error('加载用户参与次数失败:', error);
      wx.showToast({
        title: '加载数据失败',
        icon: 'none'
      });
    }
  },

  /**
   * 计算用户奖项
   */
  calculateAward: function () {
    const { totalActivities, userParticipations } = this.data;
    
    // 计算参与比例
    let participationRate = 0;
    if (totalActivities > 0) {
      participationRate = Math.round((userParticipations / totalActivities) * 100);
    }
    
    // 根据参与比例计算奖项
    let userAward = "参与奖";
    if (participationRate >= 85) {
      userAward = "一等奖";
    } else if (participationRate >= 75) {
      userAward = "二等奖";
    } else if (participationRate >= 60) {
      userAward = "三等奖";
    }
    
    // 更新数据
    this.setData({
      participationRate,
      userAward
    });
  }
})