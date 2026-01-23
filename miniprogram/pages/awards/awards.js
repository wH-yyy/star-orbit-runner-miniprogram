// pages/awards/awards.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    totalActivities: 20, // 总活动次数
    userParticipations: 15, // 用户参与次数
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
    this.calculateAward();
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
    // 每次显示页面时重新计算奖项，确保数据最新
    this.calculateAward();
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
    // 下拉刷新时重新计算奖项
    this.calculateAward();
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
    if (participationRate >= 90) {
      userAward = "一等奖";
    } else if (participationRate >= 70) {
      userAward = "二等奖";
    } else if (participationRate >= 50) {
      userAward = "三等奖";
    }
    
    // 更新数据
    this.setData({
      participationRate,
      userAward
    });
  }
})