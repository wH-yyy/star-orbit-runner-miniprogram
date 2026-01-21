// pages/edit-profile/edit-profile.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    // 用户信息
    userInfo: {
      avatar: '/images/avatar.png',
      name: '',
      studentId: '',
      campus: '',
      academy: '',
      className: ''
    },
    // 校区列表
    campusList: ['(请选择)', '兴庆校区', '雁塔校区', '创新港校区'],
    // 书院列表
    academyList: ['(请选择)', '彭康书院', '文治书院', '宗濂书院', '南洋书院', '崇实书院', '仲英书院', '励志书院', '启德书院', '钱学森书院'],
    // 当前选中的校区和书院索引
    campusIndex: 0,
    academyIndex: 0
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 如果用户已有信息，设置对应的选中索引
    const { userInfo, campusList, academyList } = this.data;
    
    if (userInfo.campus) {
      const campusIndex = campusList.indexOf(userInfo.campus);
      if (campusIndex > -1) {
        this.setData({
          campusIndex
        });
      }
    }
    
    if (userInfo.academy) {
      const academyIndex = academyList.indexOf(userInfo.academy);
      if (academyIndex > -1) {
        this.setData({
          academyIndex
        });
      }
    }
  },
  
  // 校区选择事件
  onCampusChange(e) {
    const campusIndex = e.detail.value;
    const campus = this.data.campusList[campusIndex];
    
    this.setData({
      campusIndex,
      'userInfo.campus': campus
    });
  },
  
  // 书院选择事件
  onAcademyChange(e) {
    const academyIndex = e.detail.value;
    const academy = this.data.academyList[academyIndex];
    
    this.setData({
      academyIndex,
      'userInfo.academy': academy
    });
  }
})