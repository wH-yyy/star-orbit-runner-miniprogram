// pages/awards/awards.js
Page({
  data: {
    totalActivities: 60, // 总活动次数（固定为60次）
    userParticipations: 0, // 用户参与次数
    participationRate: 0, // 参与比例
    userAwardList: ['一等奖', '二等奖', '三等奖', '运动奖'], // 用户奖项
    userAwardIndex: 0
  },

  onLoad() {
    this.setData({
      userParticipations: getApp().globalData.userInfo.totalCount || 0
    })
    this.calculateAward();
  },

  onPullDownRefresh() {
    this.loadUserParticipations();
    wx.stopPullDownRefresh();
  },

  async loadUserParticipations() {
    try {
      // 从数据库获取用户信息，包含打卡记录次数
      const db = wx.cloud.database();
      const res = await db.collection('Users').doc(getApp().globalData.userInfo._id).get();
      
      if (res.data.length > 0) {
        const userInfo = {
          ...res.data[0],
          avatar: res.data[0].gender === '男'? '/images/male-avatar.jpg' : '/images/female-avatar.jpg'
        }
        // 更新本地存储和全局数据
        const app = getApp()
        app.globalData.userInfo = userInfo
        wx.setStorageSync('userInfo', userInfo)
        
        // 更新用户参与次数
        this.setData({
          userParticipations: userInfo.totalCount || 0
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

  calculateAward() {
    const { totalActivities, userParticipations } = this.data;
    
    // 计算参与比例
    let participationRate = 0;
    if (totalActivities > 0) {
      participationRate = Math.round((userParticipations / totalActivities) * 100);
    }
    
    // 根据参与比例计算奖项
    let userAwardIndex = 0;
    if (participationRate >= 85) {
      userAwardIndex = 0;
    } else if (participationRate >= 75) {
      userAwardIndex = 1;
    } else if (participationRate >= 60) {
      userAwardIndex = 2;
    } else {
      userAwardIndex = 3;
    }
    
    // 更新数据
    this.setData({
      participationRate,
      userAwardIndex
    });
  }
})